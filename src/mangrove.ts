import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  Approval,
  CleanComplete,
  CleanStart,
  Credit,
  Debit,
  Kill,
  NewMgv,
  OfferFail,
  OfferFailWithPosthookData,
  OfferRetract,
  OfferSuccess,
  OfferSuccessWithPosthookData,
  OfferWrite,
  OrderComplete,
  OrderStart,
  SetActive,
  SetDensity96X32,
  SetFee,
  SetGasbase,
  SetGasmax,
  SetGasprice,
  SetGovernance,
  SetMaxGasreqForFailingOffers,
  SetMaxRecursionDepth,
  SetMonitor,
  SetNotify,
  SetUseOracle
} from "../generated/Mangrove/Mangrove";
import { CleanOrder, Kandel, Market, Offer, OfferFilled, Order } from "../generated/schema";
import { getEventUniqueId, getOfferId, getOrCreateAccount, getOrCreateToken } from "./helpers";
import {
  addCleanOrderToStack,
  addOfferWriteToStack,
  addOrderToStack,
  getLatestCleanOrderFromStack,
  getLatestLimitOrderFromStack,
  getLatestOrderFromStack,
  getOfferWriteFromStack,
  removeLatestCleanOrderFromStack,
  removeLatestOrderFromStack
} from "./stack";
import { limitOrderSetIsOpen } from "./mangrove-order";
import { addOfferToCurrentBundle } from "./mangrove-amplifier";
import { PartialOfferWrite } from "./types";

export function handleApproval(event: Approval): void {}

export function handleCredit(event: Credit): void {}

export function handleDebit(event: Debit): void {}

export function handleKill(event: Kill): void {}

export function handleNewMgv(event: NewMgv): void {}

export function handleOfferFailWithPosthookData(event: OfferFailWithPosthookData): void {
  handleOfferFailEvent(changetype<OfferFail>(event), event.params.posthookData);
}

export function handleOfferFail(event: OfferFail): void {
  handleOfferFailEvent(event);
}

export function handleOfferFailEvent(event: OfferFail, posthookData: Bytes | null = null): void {
  const offerId = getOfferId(event.params.olKeyHash, event.params.id);
  const offer = Offer.load(offerId)!;

  offer.isOpen = false;
  offer.isFailed = true;
  offer.isFilled = false;
  offer.isRetracted = false;
  offer.posthookFailReason = null;
  offer.gasprice = BigInt.fromI32(0);

  offer.failedReason = event.params.mgvData;
  offer.latestUpdateDate = event.block.timestamp;
  offer.latestLogIndex = event.logIndex;
  offer.latestTransactionHash = event.transaction.hash;
  offer.posthookFailReason = posthookData;
  offer.latestPenalty = event.params.penalty;
  offer.totalPenalty = offer.totalPenalty.plus(event.params.penalty);
  limitOrderSetIsOpen(offer.limitOrder, false);
  offer.save();

  const normalOrder = getLatestOrderFromStack(false);
  if (normalOrder) {
    normalOrder.penalty = normalOrder.penalty !== null ? normalOrder.penalty.plus(event.params.penalty) : event.params.penalty;
    normalOrder.save();
  } else {
    // TODO: add proper handling of clean order
  }
}

export function handleOfferRetract(event: OfferRetract): void {
  const offerId = getOfferId(event.params.olKeyHash, event.params.id);
  const offer = Offer.load(offerId)!;

  offer.isOpen = false;
  offer.isRetracted = true;
  offer.isFailed = false;
  offer.isFilled = false;
  offer.posthookFailReason = null;
  offer.failedReason = null;
  offer.deprovisioned = event.params.deprovision;

  if (event.params.deprovision) {
    offer.gasprice = BigInt.fromI32(0);
  }

  offer.latestUpdateDate = event.block.timestamp;
  offer.latestLogIndex = event.logIndex;
  offer.latestTransactionHash = event.transaction.hash;

  limitOrderSetIsOpen(offer.limitOrder, false);

  offer.save();
}

export function handleOfferSuccessWithPosthookData(event: OfferSuccessWithPosthookData): void {
  handleOfferSuccessEvent(changetype<OfferSuccess>(event), event.params.posthookData);
}

export function handleOfferSuccess(event: OfferSuccess): void {
  handleOfferSuccessEvent(event);
}

export function handleOfferSuccessEvent(event: OfferSuccess, posthookData: Bytes | null = null): void {
  const offerId = getOfferId(event.params.olKeyHash, event.params.id);
  const offer = Offer.load(offerId)!;

  if (offer.gives == event.params.takerWants) {
    offer.isFilled = true;
  }
  limitOrderSetIsOpen(offer.limitOrder, false);
  offer.isOpen = false;
  offer.isFailed = false;
  offer.isRetracted = false;
  offer.posthookFailReason = null;
  offer.failedReason = null;
  offer.latestUpdateDate = event.block.timestamp;
  offer.latestLogIndex = event.logIndex;
  offer.latestTransactionHash = event.transaction.hash;
  offer.prevGives = offer.gives;
  offer.prevTick = offer.tick;
  offer.gives = BigInt.fromI32(0);
  offer.totalGot = event.params.takerGives.plus(offer.totalGot);
  offer.totalGave = event.params.takerWants.plus(offer.totalGave);
  offer.posthookFailReason = posthookData;
  offer.latestPenalty = BigInt.fromI32(0);

  const owner = Address.fromBytes(offer.owner !== null ? offer.owner! : offer.maker);

  let order = getLatestOrderFromStack(true);

  const offerFilled = new OfferFilled(getEventUniqueId(event));
  offerFilled.creationDate = event.block.timestamp;
  offerFilled.transactionHash = event.transaction.hash;
  offerFilled.taker = order.taker;
  offerFilled.account = owner;
  offerFilled.makerGot = event.params.takerGives;
  offerFilled.makerGave = event.params.takerWants;
  offerFilled.offer = offer.id;
  offerFilled.market = offer.market;
  offerFilled.save();

  order.takerGot = order.takerGot ? order.takerGot.plus(event.params.takerWants) : event.params.takerWants;
  order.takerGave = order.takerGave ? order.takerGave.plus(event.params.takerGives) : event.params.takerGives;
  order.save();

  offer.save();
}

export const createNewOffer = (event: PartialOfferWrite): Offer => {
  const offerId = getOfferId(event.olKeyHash, event.id);
  const offer = new Offer(offerId);
  offer.latestLogIndex = event.logIndex;
  offer.latestTransactionHash = event.transactionHash;

  const kandel = Kandel.load(event.maker);
  if (kandel !== null) {
    offer.kandel = kandel.id;
  }

  return offer;
};

const handlePartialOfferWrite = (offerWrite: PartialOfferWrite): void => {
  const offerId = getOfferId(offerWrite.olKeyHash, offerWrite.id);
  let offer = Offer.load(offerId);

  if (!offer) {
    offer = createNewOffer(offerWrite);
    offer.creationDate = offerWrite.timestamp;
    offer.totalGot = BigInt.fromI32(0);
    offer.totalGave = BigInt.fromI32(0);
    offer.totalPenalty = BigInt.fromI32(0);
    // Adds to current bundle if creating one
    addOfferToCurrentBundle(offer);
  }

  offer.latestUpdateDate = offerWrite.timestamp;
  offer.latestLogIndex = offerWrite.logIndex;
  offer.latestTransactionHash = offerWrite.transactionHash;

  const owner = getOrCreateAccount(Address.fromBytes(offerWrite.maker), offerWrite.timestamp, true);
  offer.maker = owner.id;

  const marketId = offerWrite.olKeyHash.toHex();
  const market = Market.load(marketId)!;
  offer.market = market.id;
  offer.gasBase = market.gasbase;

  offer.offerId = offerWrite.id;

  offer.tick = offerWrite.tick;
  offer.gives = offerWrite.gives;

  offer.gasprice = offerWrite.gasprice;
  offer.gasreq = offerWrite.gasreq;
  offer.isOpen = true;
  offer.isFailed = false;
  offer.isFilled = false;
  offer.isRetracted = false;
  offer.deprovisioned = false;
  offer.failedReason = null;
  offer.posthookFailReason = null;
  offer.latestPenalty = BigInt.fromI32(0);
  limitOrderSetIsOpen(offer.limitOrder, true);

  if (offer.kandel) {
    const kandel = Kandel.load(offer.kandel!);
    offer.owner = kandel!.admin;
  }

  offer.save();
};

export function handleOfferWrite(event: OfferWrite): void {
  const cleanStack = getLatestCleanOrderFromStack();
  if (cleanStack) {
    addOfferWriteToStack("CleanOrder", event);
    return;
  }

  const orderStack = getLatestOrderFromStack(false);
  if (orderStack) {
    addOfferWriteToStack("Order", event);
    return;
  }

  handlePartialOfferWrite(PartialOfferWrite.fromOfferWrite(event));
}

export function handleOrderStart(event: OrderStart): void {
  const order = new Order(getEventUniqueId(event));
  order.transactionHash = event.transaction.hash;
  order.creationDate = event.block.timestamp;
  order.fillVolume = event.params.fillVolume;
  order.maxTick = event.params.maxTick;
  order.fillWants = event.params.fillWants;
  order.taker = getOrCreateAccount(event.params.taker, event.block.timestamp, true).id;
  order.market = event.params.olKeyHash.toHex();

  // 0 offers could be matched and therefore have to initialize the 4 fields
  order.penalty = BigInt.fromI32(0);
  order.takerGot = BigInt.fromI32(0);
  order.takerGave = BigInt.fromI32(0);
  order.feePaid = BigInt.fromI32(0);

  const cleanOrder = getLatestCleanOrderFromStack();
  if (cleanOrder != null) {
    order.cleanOrder = cleanOrder.id;
  }

  const limitOrder = getLatestLimitOrderFromStack();
  if (limitOrder !== null) {
    order.limitOrder = limitOrder.id;
    limitOrder.order = order.id;
    limitOrder.save();
  }

  order.save();
  addOrderToStack(order);
}

export function handleOrderComplete(event: OrderComplete): void {
  const order = getLatestOrderFromStack(true);
  order.feePaid = event.params.fee;
  order.save();

  const offerWrites = getOfferWriteFromStack("Order");

  for (let i = 0; i < offerWrites.length; i++) {
    handlePartialOfferWrite(offerWrites.at(i));
  }

  removeLatestOrderFromStack();
}

export function handleCleanStart(event: CleanStart): void {
  const order = new CleanOrder(getEventUniqueId(event));
  order.transactionHash = event.transaction.hash;
  order.creationDate = event.block.timestamp;
  order.offersToBeCleaned = event.params.offersToBeCleaned;
  order.taker = getOrCreateAccount(event.params.taker, event.block.timestamp, true).id;
  order.market = event.params.olKeyHash.toHex();
  order.save();

  addCleanOrderToStack(order);
}

export function handleCleanComplete(event: CleanComplete): void {
  const offerWrites = getOfferWriteFromStack("CleanOrder");

  for (let i = 0; i < offerWrites.length; i++) {
    handlePartialOfferWrite(offerWrites.at(i));
  }
  removeLatestCleanOrderFromStack();
}

export function handleSetActive(event: SetActive): void {
  const marketId = event.params.olKeyHash.toHex();
  let market = Market.load(marketId);

  if (!market) {
    market = new Market(marketId);

    getOrCreateToken(event.params.outbound_tkn);
    getOrCreateToken(event.params.inbound_tkn);

    market.outbound_tkn = event.params.outbound_tkn;
    market.inbound_tkn = event.params.inbound_tkn;
    market.tickSpacing = event.params.tickSpacing;
    market.gasbase = BigInt.fromI32(0);
    market.fee = BigInt.fromI32(0);
  }

  market.active = event.params.value;

  market.save();
}

export function handleSetDensity(event: SetDensity96X32): void {}

export function handleSetFee(event: SetFee): void {
  const marketId = event.params.olKeyHash.toHex();
  let market = Market.load(marketId);

  if (!market) {
    throw new Error("Market not found for set-fee event " + marketId);
  }

  market.fee = event.params.value;
  market.save();
}

export function handleSetGasbase(event: SetGasbase): void {
  const marketId = event.params.olKeyHash.toHex();
  let market = Market.load(marketId);
  if (!market) {
    market = new Market(marketId);
    market.active = false;
    market.fee = BigInt.fromI32(0);
  }
  market.gasbase = event.params.offer_gasbase;

  market.save();
}

export function handleSetGasmax(event: SetGasmax): void {}

export function handleSetGasprice(event: SetGasprice): void {}

export function handleSetGovernance(event: SetGovernance): void {}

export function handleSetMonitor(event: SetMonitor): void {}

export function handleSetNotify(event: SetNotify): void {}

export function handleSetUseOracle(event: SetUseOracle): void {}

export function handleSetMaxGasreqForFailingOffers(event: SetMaxGasreqForFailingOffers): void {}

export function handleSetMaxRecursionDepth(event: SetMaxRecursionDepth): void {}
