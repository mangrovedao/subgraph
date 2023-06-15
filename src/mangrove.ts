import { Address, BigInt, Bytes, Value, ethereum } from "@graphprotocol/graph-ts"
import {
  Mangrove,
  Approval,
  Credit,
  Debit,
  Kill,
  NewMgv,
  OfferFail,
  OfferRetract,
  OfferSuccess,
  OfferWrite,
  OrderComplete,
  OrderStart,
  PosthookFail,
  SetActive,
  SetDensity,
  SetFee,
  SetGasbase,
  SetGasmax,
  SetGasprice,
  SetGovernance,
  SetMonitor,
  SetNotify,
  SetUseOracle,
  MarketOrderCall
} from "../generated/Mangrove/Mangrove"
import { Market, Order, Offer, Kandel } from "../generated/schema"
import { addMarketOrderDataToStack, addOrderToStack, getEventUniqueId, getMarketId, getMarketOrderDataFromStack, getOfferId, getOrCreateAccount, getOrderFromStack, removeMarketOrderDataFromStack, removeOrderFromStack } from "./helpers";

export function handleApproval(event: Approval): void {}

export function handleCredit(event: Credit): void {}

export function handleDebit(event: Debit): void {}

export function handleKill(event: Kill): void {}

export function handleNewMgv(event: NewMgv): void {}

export function handleOfferFail(event: OfferFail): void {
  const offerId = getOfferId(
    event.params.outbound_tkn, 
    event.params.inbound_tkn,
    event.params.id,
  );
  const offer = Offer.load(offerId)!;

  offer.isOpen = false;
  offer.isFailed = false;

  offer.failedReason = event.params.mgvData;

  offer.save();
}

export function handleOfferRetract(event: OfferRetract): void {
  const offerId = getOfferId(
    event.params.outbound_tkn, 
    event.params.inbound_tkn,
    event.params.id,
  );
  const offer = Offer.load(offerId)!; 

  offer.isOpen = false;
  offer.isRetracted = true;

  offer.save();
}

export function handleOfferSuccess(event: OfferSuccess): void {
  const offerId = getOfferId(
    event.params.outbound_tkn, 
    event.params.inbound_tkn,
    event.params.id,
  );
  const offer = Offer.load(offerId)!;

  offer.wants = offer.wants.minus(event.params.takerGives);
  offer.gives = offer.gives.minus(event.params.takerWants);

  if (offer.kandel) {
    const kandel = Kandel.load(offer.kandel!)!;
    const market = Market.load(offer.market)!;

    if (market.outbound_tkn == kandel.base) {
      // takerWants == outbound_tkn
      kandel.totalBase = kandel.totalBase.minus(event.params.takerWants);
      kandel.totalQuote = kandel.totalQuote.plus(event.params.takerGives);
    } else {
      // takerWants == inbound_tkn
      kandel.totalBase = kandel.totalBase.plus(event.params.takerGives);
      kandel.totalQuote = kandel.totalQuote.minus(event.params.takerWants);
    }

    kandel.save();
  }

  const BN_0 = BigInt.fromI32(0);
  if (offer.wants == BN_0 && offer.gives == BN_0) {
    offer.isFilled = true;
  }
  offer.isOpen = false;

  offer.save();
}

const createNewOffer = (event: OfferWrite): Offer => {
  const offerId = getOfferId(
    event.params.outbound_tkn, 
    event.params.inbound_tkn,
    event.params.id,
  );
  const offer = new Offer(offerId);
  offer.transactionHash = event.transaction.hash;
  offer.initialWants = event.params.wants;
  offer.initialGives = event.params.gives;

  const kandel = Kandel.load(event.params.maker);
  if (kandel) {
    offer.kandel = kandel.id;
  }

  return offer;
}

export function handleOfferWrite(event: OfferWrite): void {
  const offerId = getOfferId(
    event.params.outbound_tkn, 
    event.params.inbound_tkn,
    event.params.id,
  );
  let offer = Offer.load(offerId);
  if (!offer) {
    offer = createNewOffer(event);
  }

  const owner = getOrCreateAccount(event.params.maker);
  offer.maker = owner.id;

  const marketId = getMarketId(
    event.params.outbound_tkn,
    event.params.inbound_tkn,
  );
  const market = Market.load(marketId)!;
  offer.market = market.id;

  offer.offerId = event.params.id;

  offer.wants = event.params.wants,
  offer.gives = event.params.gives,

  offer.gasprice = event.params.gasprice,
  offer.gasreq = event.params.gasreq,
  offer.prev = event.params.prev,
  offer.isOpen = true;
  offer.isFailed = false;
  offer.isFilled = false;
  offer.isRetracted = false;

  offer.save();
}

export function handleOrderComplete(event: OrderComplete): void {
  const order = getOrderFromStack();

  order.taker = event.params.taker;
  order.realTaker = event.params.taker; // for market order realTaker == event.params.taker
  order.takerGot = event.params.takerGot;
  order.takerGave = event.params.takerGave;
  order.penalty = event.params.penalty;
  order.feePaid = event.params.feePaid;

  order.save();

  removeOrderFromStack();
  removeMarketOrderDataFromStack();
}

export function handleOrderStart(event: OrderStart): void {
  const order = new Order(getEventUniqueId(event));

  const marketOrderData = getMarketOrderDataFromStack();

  if (!marketOrderData.nodata) {
    order.type = "MARKET";
    order.marketOrderWants = marketOrderData.takerWants;
    order.marketOrderGives = marketOrderData.takerGives;
  } else {
    order.type = "LIMIT"
  }

  order.transactionHash = event.transaction.hash;
  order.save();

  addOrderToStack(order);
}

export function handlePosthookFail(event: PosthookFail): void {
  const offerId = getOfferId(
    event.params.outbound_tkn,
    event.params.inbound_tkn,
    event.params.offerId,
  );

  const offer = Offer.load(offerId)!;

  offer.posthookFailReason = event.params.posthookData;

  offer.save();
}

export function handleSetActive(event: SetActive): void {
  const marketId = getMarketId(
    event.params.outbound_tkn,
    event.params.inbound_tkn,
  );
  let market = Market.load(marketId);

  if (!market) {
    market = new Market(marketId);
    market.outbound_tkn = event.params.outbound_tkn;
    market.inbound_tkn = event.params.inbound_tkn;
  }

  market.active = event.params.value;

  market.save();
}

export function handleSetDensity(event: SetDensity): void {}

export function handleSetFee(event: SetFee): void {}

export function handleSetGasbase(event: SetGasbase): void {}

export function handleSetGasmax(event: SetGasmax): void {}

export function handleSetGasprice(event: SetGasprice): void {}

export function handleSetGovernance(event: SetGovernance): void {}

export function handleSetMonitor(event: SetMonitor): void {}

export function handleSetNotify(event: SetNotify): void {}

export function handleSetUseOracle(event: SetUseOracle): void {}

export function handleMarketOrder(call: MarketOrderCall): void {
  const inputs = call.inputs;
  addMarketOrderDataToStack(inputs);
}
