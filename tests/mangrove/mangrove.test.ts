import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach
} from "matchstick-as/assembly/index"
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { handleOfferFail, handleOfferRetract, handleOfferSuccess, handleOfferWrite, handleOrderStart, handleSetActive } from "../../src/mangrove"
import { createOfferFailEvent, createOfferRetractEvent, createOfferSuccessEvent, createOfferWriteEvent, createOrderStartEvent, createSetActiveEvent } from "./mangrove-utils"
import { Market } from "../../generated/schema";
import { getMarketId, getOfferId } from "../../src/helpers";
// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

let token0 = Address.fromString("0x0000000000000000000000000000000000000000");
let token1 = Address.fromString("0x0000000000000000000000000000000000000001");
let maker = Address.fromString("0x0000000000000000000000000000000000000002")
let taker = Address.fromString("0x0000000000000000000000000000000000000003")
let owner = Address.fromString("0x0000000000000000000000000000000000000004")

describe("Describe entity assertions", () => {
  beforeAll(() => {

  })

  afterEach(() => {
    clearStore()
  })

  test("Market created and stored", () => {
    let setActiveEvent = createSetActiveEvent(token0, token1, true);
    handleSetActive(setActiveEvent);
    assert.entityCount("Market", 1);

    const marketId = getMarketId(token0, token1)
    const market = Market.load(marketId);
    assert.assertNotNull(market);

    assert.fieldEquals('Market', marketId, 'active', 'true');

    setActiveEvent = createSetActiveEvent(token0, token1, false);
    handleSetActive(setActiveEvent);
    
    assert.fieldEquals('Market', marketId, 'active', 'false');
    assert.entityCount("Market", 1);
  });

  test("Offer created, stored, retracted", () => {
    let setActiveEvent = createSetActiveEvent(token0, token1, true);
    handleSetActive(setActiveEvent);
    assert.entityCount("Market", 1);

    const id = BigInt.fromI32(0);
    // maybe use named parameters?
    let offerWrite = createOfferWriteEvent(
      token0, 
      token1,
      maker,
      BigInt.fromI32(1000),
      BigInt.fromI32(2000),
      BigInt.fromI32(0),
      BigInt.fromI32(0),
      id,
      BigInt.fromI32(0),
    );
    handleOfferWrite(offerWrite);

    let offerId = getOfferId(token0, token1, id);
    assert.fieldEquals('Offer', offerId, 'isOpen', 'true');

    let offerRetract = createOfferRetractEvent(
      token0,
      token1,
      id,
      false
    );
    handleOfferRetract(offerRetract);

    assert.fieldEquals('Offer', offerId, 'isOpen', 'false');

    offerWrite = createOfferWriteEvent(
      token0, 
      token1,
      maker,
      BigInt.fromI32(1000),
      BigInt.fromI32(2000),
      BigInt.fromI32(0),
      BigInt.fromI32(0),
      id,
      BigInt.fromI32(0),
    );
    handleOfferWrite(offerWrite);

    // should check that the other fields are also saved correctly, for both offers
    assert.fieldEquals('Offer', offerId, 'isOpen', 'true');

    assert.entityCount("Offer", 1);
  });

  test("Offer created, failed", () => {
    let setActiveEvent = createSetActiveEvent(token0, token1, true);
    handleSetActive(setActiveEvent);
    assert.entityCount("Market", 1);

    const id = BigInt.fromI32(0);
    let offerWrite = createOfferWriteEvent(
      token0, 
      token1,
      maker,
      BigInt.fromI32(1000),
      BigInt.fromI32(2000),
      BigInt.fromI32(0),
      BigInt.fromI32(0),
      id,
      BigInt.fromI32(0),
    );
    handleOfferWrite(offerWrite);

    let offerId = getOfferId(token0, token1, id);
    assert.fieldEquals('Offer', offerId, 'isOpen', 'true');

    let offerFail = createOfferFailEvent(
      token0,
      token1,
      id,
      taker,
      BigInt.fromI32(2000), 
      BigInt.fromI32(1000), 
      Bytes.fromUTF8("Failed"),
    );
    handleOfferFail(offerFail);

    assert.fieldEquals('Offer', offerId, 'isOpen', 'false');
    assert.fieldEquals('Offer', offerId, 'wants', '1000');
    assert.fieldEquals('Offer', offerId, 'gives', '2000');

    offerWrite = createOfferWriteEvent(
      token0, 
      token1,
      maker,
      BigInt.fromI32(500), // wants
      BigInt.fromI32(1000),// gives
      BigInt.fromI32(0),
      BigInt.fromI32(0),
      id,
      BigInt.fromI32(0),
    );
    handleOfferWrite(offerWrite);

    assert.fieldEquals('Offer', offerId, 'isOpen', 'true');
    assert.fieldEquals('Offer', offerId, 'wants', '500');
    assert.fieldEquals('Offer', offerId, 'gives', '1000');

    assert.entityCount("Offer", 1);
  });

  test("Offer created, partially filled, fully filled", () => {
    let setActiveEvent = createSetActiveEvent(token0, token1, true);
    handleSetActive(setActiveEvent);
    assert.entityCount("Market", 1);

    const order = createOrderStartEvent();
    handleOrderStart(order);

    const id = BigInt.fromI32(0);
    let offerWrite = createOfferWriteEvent(
      token0, 
      token1,
      maker,
      BigInt.fromI32(1000), // wants
      BigInt.fromI32(2000), // gives
      BigInt.fromI32(0),
      BigInt.fromI32(0),
      id,
      BigInt.fromI32(0),
    );
    handleOfferWrite(offerWrite);

    let offerSuccess = createOfferSuccessEvent(token0, token1, id, taker, BigInt.fromI32(10), BigInt.fromI32(20));
    handleOfferSuccess(offerSuccess);

    let offerId = getOfferId(token0, token1, id);

    assert.fieldEquals('Offer', offerId, 'wants', '980');
    assert.fieldEquals('Offer', offerId, 'gives', '1990');
    assert.fieldEquals('Offer', offerId, 'isFilled', 'false');

    offerSuccess = createOfferSuccessEvent(token0, token1, id, taker, BigInt.fromI32(1990), BigInt.fromI32(980));
    handleOfferSuccess(offerSuccess);

    assert.fieldEquals('Offer', offerId, 'wants', '0');
    assert.fieldEquals('Offer', offerId, 'gives', '0');
    assert.fieldEquals('Offer', offerId, 'isOpen', 'false');
    assert.fieldEquals('Offer', offerId, 'isFilled', 'true');

    offerWrite = createOfferWriteEvent(
      token0, 
      token1,
      maker,
      BigInt.fromI32(500), // wants
      BigInt.fromI32(1000), // gives
      BigInt.fromI32(0),
      BigInt.fromI32(0),
      id,
      BigInt.fromI32(0),
    );
    handleOfferWrite(offerWrite);

    assert.fieldEquals('Offer', offerId, 'wants', '500');
    assert.fieldEquals('Offer', offerId, 'gives', '1000');
    assert.fieldEquals('Offer', offerId, 'isOpen', 'true');
    assert.fieldEquals('Offer', offerId, 'isFilled', 'false');

    assert.entityCount("Offer", 1);
  });

});
