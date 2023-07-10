import { log } from "matchstick-as";
import {
  LogIncident,
  Mgv,
  NewOwnedOffer,
  OrderSummary,
  SetAdmin,
  SetExpiry,
  SetRouter
} from "../generated/MangroveOrder/MangroveOrder"
import { LimitOrder, Offer } from "../generated/schema"
import { getEventUniqueId, getLastOrder, getOfferId, getOrCreateAccount } from "./helpers"
import { BigInt } from "@graphprotocol/graph-ts";

export function handleLogIncident(event: LogIncident): void {}

export function handleMgv(event: Mgv): void {}

export function handleNewOwnedOffer(event: NewOwnedOffer): void {
  const offerId = getOfferId(
    event.params.outbound_tkn, 
    event.params.inbound_tkn, 
    event.params.offerId
  );
  const offer = Offer.load(offerId);
  if (!offer) {
    log.error("missing offer with id: {}", [offerId]);
    return;
  }

  const owner = getOrCreateAccount(event.params.owner);
  offer.owner = owner.id;
  offer.save();
}

export function handleOrderSummary(event: OrderSummary): void {
  const order = getLastOrder();
  let limitOrder = null as LimitOrder | null;
  
  if (event.params.restingOrderId != BigInt.fromI32(0)) {
    const offerId = getOfferId(
      event.params.inbound_tkn, // reverse inbound_tkn and outbound_tkn because we are in Order
      event.params.outbound_tkn,
      event.params.restingOrderId,
    );
    const offer = Offer.load(offerId);
    if (!offer) {
      log.error("Missing offerId {} {}", [offerId, event.transaction.hash.toHex()]);
      return;
    }
    limitOrder = new LimitOrder(offerId);
    limitOrder.offer = offer.id;
  } else {
    limitOrder = new LimitOrder(getEventUniqueId(event));
  }

  limitOrder.wants = event.params.takerWants;
  limitOrder.gives = event.params.takerGives;
  limitOrder.realTaker = event.params.taker;
  limitOrder.expiryDate = event.params.expiryDate;
  limitOrder.fillOrKill = event.params.fillOrKill;
  limitOrder.fillWants = event.params.fillWants;
  limitOrder.restingOrder = event.params.restingOrder;
  limitOrder.creationDate = event.block.timestamp;
  limitOrder.latestUpdateDate = event.block.timestamp;
  limitOrder.order = order.id;

  limitOrder.isOpen = event.params.restingOrderId != BigInt.fromI32(0);

  order.limitOrder  = limitOrder.id;

  order.save();
  limitOrder.save();
}

export function handleSetAdmin(event: SetAdmin): void {}

export function handleSetExpiry(event: SetExpiry): void {
  const offerId = getOfferId(
    event.params.outbound_tkn,
    event.params.inbound_tkn,
    event.params.offerId,
  );
  const limitOrder = LimitOrder.load(offerId);
  if (!limitOrder) {
    log.debug("Missing limit order for offerId {}", [offerId]);
    return;
  }
  limitOrder.expiryDate = event.params.date;
  limitOrder.latestUpdateDate= event.block.timestamp;
  limitOrder.save();
}

export function handleSetRouter(event: SetRouter): void {}
