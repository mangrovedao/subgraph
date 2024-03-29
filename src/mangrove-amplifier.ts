import { log } from "matchstick-as";
import {
  EndBundle as EndBundleEvent,
  InitBundle as InitBundleEvent,
  NewOwnedOffer,
  SetReneging as SetRenegingEvent
} from "../generated/MangroveAmplifier/MangroveAmplifier";
import { BigInt } from "@graphprotocol/graph-ts";

import { Offer, AmplifiedOffer, AmplifiedOfferBundle } from "../generated/schema";
import { getEventUniqueId, getOrCreateAccount } from "./helpers";
import { addBundleToStack, getLatestBundleFromStack, removeLatestBundleFromStack } from "./stack";

export function addOfferToCurrentBundle(offer: Offer): void {
  const bundle = getLatestBundleFromStack();
  if (bundle === null) {
    return;
  }

  const amplifiedOffer = new AmplifiedOffer(offer.id);
  amplifiedOffer.bundle = bundle.id;
  amplifiedOffer.offer = offer.id;
  amplifiedOffer.save();

  bundle.offers = bundle.offers.concat([amplifiedOffer.id]);
  bundle.save();

  offer.amplifiedOffer = amplifiedOffer.id;
  // offer.save();
}

export function handleInitBundle(event: InitBundleEvent): void {
  const entity = new AmplifiedOfferBundle(getEventUniqueId(event));
  entity.creationDate = event.block.timestamp;
  entity.bundleId = event.params.bundleId;
  entity.offers = new Array<string>();
  entity.expiryDate = BigInt.fromI32(0);
  entity.save();
  addBundleToStack(entity);
}

export function handleNewOwnedOffer(event: NewOwnedOffer): void {
  const amplifiedBundle = getLatestBundleFromStack();
  const owner = getOrCreateAccount(event.params.owner, event.block.timestamp, false);
  if (amplifiedBundle !== null) {
    amplifiedBundle.owner = owner.id;
    for (let i = 0; i < amplifiedBundle.offers.length; i++) {
      const offer = AmplifiedOffer.load(amplifiedBundle.offers[i]);
      if (offer !== null) {
        offer.owner = owner.id;
        offer.save();
      }
    }
    amplifiedBundle.save();
  } else {
    throw new Error(`Missing mangrove amplified bundle - tx: ${event.transaction.hash.toHex()}`);
  }
}

export function handleEndBundle(event: EndBundleEvent): void {
  removeLatestBundleFromStack();
}

export function handleSetReneging(event: SetRenegingEvent): void {
  const bundle = getLatestBundleFromStack();
  if (bundle === null) {
    return;
  }

  bundle.expiryDate = event.params.date;
  bundle.save();
}
