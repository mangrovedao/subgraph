import { Address, BigInt, Value } from "@graphprotocol/graph-ts"
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
  SetUseOracle
} from "../generated/Mangrove/Mangrove"
import { Market, Account, Order, Offer, Contex } from "../generated/schema"
import { getMarketId, getOfferId } from "./helpers";

const getOrCreateAccount = (address: Address): Account => {
  let account = Account.load(address);

  if (!account) {
    account = new Account(address);
    account.address = address;
    account.save();
  }

  return account;
}

const addOrderToQueue = (order: Order): void => {
  let context = Contex.load('context');
  let currentId = 0;
  if (!context) {
    context = new Contex('context');
    context.setI32('currentId', 0);
  } else {
    let valueCurrentId = context.get('currentId');
    if (valueCurrentId) {
      currentId = valueCurrentId.toI32();
    } else {
      currentId = 0;
    }
  }

  context.set(currentId.toString(), Value.fromString(order.id));

  currentId = currentId + 1;
  context.setI32('currentId', currentId);

  context.save();
}

const getOrderFromQueue = (): Order => {
  const context = Contex.load('context')!;

  const currentId = context.getI32('currentId');

  const orderId = context.get((currentId - 1).toString())!.toString();

  const order = Order.load(orderId)!;

  return order;
}

const removeOrderFromQueue = (): void => {
  let context = Contex.load('context')!;
  let currentId = context.getI32('currentId');

  context.unset(currentId.toString());

  currentId = currentId - 1;

  context.setI32('currentId', currentId);

  context.save();
}

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

  offer.failedReason = event.params.mgvData.toString();

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

  const BN_0 = BigInt.fromI32(0);
  if (offer.wants == BN_0 && offer.gives == BN_0) {
    offer.isOpen = false;
    offer.isFilled = true;

    const newOfferId = `${offerId}-${event.transaction.hash.toHex()}-${event.logIndex.toHex()}`;
    offer.unset(offerId);
    offer.id = newOfferId;

    let orders = offer.orders!;
    for (let i = 0 ; i < orders.length ; ++i) {
      const order = Order.load(orders[i])!;
      for (let j = 0 ; j < order.offers!.length ; ++j) {
        const referencedOffer = Offer.load(order.offers![j])!;
        if (referencedOffer.id === offerId) {
          referencedOffer.id = newOfferId;
        }
      }
    }

    offer.orders = orders;
  }

  const order = getOrderFromQueue();

  let offers = order.offers;
  if (!offers) {
    offers = new Array<string>();
  }
  offers.push(offer.id);
  order.offers = offers;

  let orders = offer.orders!;
  orders.push(order.id);
  offer.orders = orders;

  offer.save();
  order.save();
}

export function handleOfferWrite(event: OfferWrite): void {
  const offerId = getOfferId(
    event.params.outbound_tkn, 
    event.params.inbound_tkn,
    event.params.id,
  );

  let offer = Offer.load(offerId);
  if (!offer) {
    offer = new Offer(offerId);
    offer.transactionHash = event.transaction.hash;
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
  offer.initialWants = event.params.wants;

  offer.gives = event.params.gives,
  offer.initialGives = event.params.gives;

  offer.gasprice = event.params.gasprice,
  offer.gasreq = event.params.gasreq,
  offer.prev = event.params.prev,
  offer.isOpen = true;
  offer.isFailed = false;
  offer.isFilled = false
  let orders = offer.orders;
  if (!orders) {
    offer.orders = new Array<string>();
  }
 
  offer.save();
}

export function handleOrderComplete(event: OrderComplete): void {
  const order = getOrderFromQueue();
  
  order.taker = event.params.taker;
  order.takerGot = event.params.takerGot;
  order.takerGave = event.params.takerGave;
  order.penalty = event.params.penalty;
  order.feePaid = event.params.feePaid;

  order.save();

  removeOrderFromQueue();
}

export function handleOrderStart(event: OrderStart): void {
  const id = `${event.address.toHex()}-${event.transaction.hash.toHex()}-${event.logIndex.toHex()}`;
  const order = new Order(id);

  order.offers = new Array<string>();
  order.save();

  addOrderToQueue(order);
}

export function handlePosthookFail(event: PosthookFail): void {}

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
