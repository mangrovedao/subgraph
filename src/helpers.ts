import { Address, BigInt, Value, ethereum } from "@graphprotocol/graph-ts";
import { Account, Contex, Order } from "../generated/schema";
import { MarketOrderCall__Inputs } from "../generated/Mangrove/Mangrove";

export const getMarketId = (outbound_tkn: Address, inbound_tkn: Address): string  => {
  return `${outbound_tkn.toHex()}-${inbound_tkn.toHex()}`;
};

export const getOfferId = (outbound_tkn: Address, inbound_tkn: Address, id: BigInt): string => {
  return `${outbound_tkn.toHex()}-${inbound_tkn.toHex()}-${id.toHex()}`;
};

export const getOrCreateAccount = (address: Address): Account => {
  let account = Account.load(address);

  if (!account) {
    account = new Account(address);
    account.address = address;
    account.save();
  }

  return account;
}

export const getContext = (): Contex => {
  let context = Contex.load('context');
  if (!context) {
    context = new Contex('context');
    context.ids = "";
    context.marketOrders = "";

    context.save();
  }

  return context;
}

export const addOrderToStack = (order: Order): void => {
  const context = getContext();
  context.ids = `${context.ids}|${order.id}`

  context.save();
}

export const getOrderFromStack = (): Order => {
  const context = getContext();
  const ids = context.ids;

  const idsArray = ids.split('|');
  const order = Order.load(idsArray[idsArray.length - 1])!;

  return order;
}

export const removeOrderFromStack = (): void => {
  const context = getContext();

  const ids = context.ids;
  for (let i = ids.length - 1 ; i >= 0 ; --i) {
    if (ids.at(i) == '|' || i == 0) {
      context.ids = ids.slice(0, i);
      context.last = ids.slice(i + 1);
      break;
    }
  }

  context.save();
}

export const getLastOrder = (): Order => {
  const context = getContext();

  const order = Order.load(context.last!)!;
  return order;
}

export const getEventUniqueId = (event: ethereum.Event): string => {
  return `${event.transaction.hash.toHex()}-${event.logIndex.toHex()}`;
}


export const addMarketOrderDataToStack = (order: MarketOrderCall__Inputs): void => { 
  const context = getContext();

  const marketOrderDataEncoded = `${order.takerGives}-${order.takerWants}`;
  context.marketOrders = `${context.marketOrders}/${marketOrderDataEncoded}`;

  context.save();
}

export const removeMarketOrderDataFromStack = (): void => {
  const context = getContext();

  const marketOrders = context.marketOrders;

  for (let i = marketOrders.length - 1; i >= 0 ; --i) {
    if (marketOrders.at(i) == '/' || i == 0)  {
      context.marketOrders = marketOrders.slice(0, i);
      break;
    }
  }

  context.save();
}

export class Data {

  nodata: boolean;
  takerGives: BigInt;
  takerWants: BigInt;

  constructor(str: string, nodata: boolean) {
    this.nodata = nodata;

    this.takerGives = BigInt.fromI32(0);
    this.takerWants = BigInt.fromI32(0);

    if (str.length !== 0)  {
      const data = str.split('-');
      const takerGivesStr = data.at(0);
      const takerWantsStr = data.at(1);

      this.takerGives = BigInt.fromString(takerGivesStr);
      this.takerWants = BigInt.fromString(takerWantsStr);
    }
  }
}

export const getMarketOrderDataFromStack = (): Data => {
  const context = getContext();

  const marketOrders = context.marketOrders;

  if (marketOrders.length === 0) {
    return new Data('', true);
  }

  for (let i = marketOrders.length  - 1; i >= 0 ; --i) {
    if (marketOrders.at(i) == '/' || i == 0)  {
      const dataAsStr = marketOrders.slice(i + 1, marketOrders.length);

      return new Data(dataAsStr, false);
    };
  }

  return new Data('', true);
}
