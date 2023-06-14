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
import { Offer } from "../generated/schema"
import { getLastOrder, getOfferId, getOrCreateAccount } from "./helpers"

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
  if (owner) {
    offer.owner = owner.id;
    offer.save();
  }
}

export function handleOrderSummary(event: OrderSummary): void {
  const order = getLastOrder();
  order.type = "LIMIT";

  if (event.params.restingOrder) {
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

    // update the offer to show that part of the order was filled
    offer.initialWants = event.params.takerWants;
    offer.initialGives = event.params.takerGives;

    order.offer = offer.id;

    offer.save();
  }

  order.save();
}

export function handleSetAdmin(event: SetAdmin): void {}

export function handleSetExpiry(event: SetExpiry): void {}

export function handleSetRouter(event: SetRouter): void {}
