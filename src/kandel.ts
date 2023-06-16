import { Address, BigInt } from "@graphprotocol/graph-ts"
import {
  Kandel,
  Credit,
  Debit,
  LogIncident,
  Mgv,
  Pair,
  PopulateEnd,
  PopulateStart,
  RetractEnd,
  RetractStart,
  SetAdmin,
  SetCompoundRates,
  SetGasprice,
  SetGasreq,
  SetGeometricParams,
  SetIndexMapping,
  SetLength,
  SetReserveId,
  SetRouter
} from "../generated/templates/Kandel/Kandel"
import { KandelDepositWithdraw, Kandel as  KandelEntity } from "../generated/schema";
import { getEventUniqueId } from "./helpers";

export function handleCredit(event: Credit): void {
  const deposit = new KandelDepositWithdraw(
    getEventUniqueId(event),
  );

  deposit.transactionHash = event.transaction.hash;
  deposit.date = event.block.timestamp;
  deposit.token = event.params.token;
  deposit.amount = event.params.amount;
  deposit.isDeposit = true;

  deposit.kandel = event.address;
  
  // checks if the kandel exists
  const kandel = KandelEntity.load(event.address)!;

  if (Address.fromBytes(kandel.base).equals(event.params.token)) {
    kandel.depositedBase = kandel.depositedBase.plus(event.params.amount);
    kandel.totalBase = kandel.totalBase.plus(event.params.amount);
  } else {
    kandel.depositedQuote = kandel.depositedQuote.plus(event.params.amount);
    kandel.totalQuote = kandel.totalQuote.plus(event.params.amount);
  }

  kandel.save()
  deposit.save();
}

export function handleDebit(event: Debit): void {
  const withdraw = new KandelDepositWithdraw(
    getEventUniqueId(event),
  );

  withdraw.transactionHash = event.transaction.hash;
  withdraw.date = event.block.timestamp;
  withdraw.token = event.params.token;
  withdraw.amount = event.params.amount;
  withdraw.isDeposit = false;

  withdraw.kandel = event.address;

  const kandel = KandelEntity.load(event.address)!;

  if (Address.fromBytes(kandel.base).equals(event.params.token)) {
    kandel.depositedBase = kandel.depositedBase.minus(event.params.amount);
    kandel.totalBase = kandel.totalBase.minus(event.params.amount);
  } else {
    kandel.depositedQuote = kandel.depositedQuote.minus(event.params.amount);
    kandel.totalQuote = kandel.totalQuote.minus(event.params.amount);
  }

  kandel.save();
  withdraw.save();
}

export function handleLogIncident(event: LogIncident): void {}

export function handleMgv(event: Mgv): void {
  // nothing to do here as we have one subgraph by mangrove
}

export function handlePair(event: Pair): void {
  // nothing to do we already have this information inside NewKandle
}

export function handlePopulateEnd(event: PopulateEnd): void {}

export function handlePopulateStart(event: PopulateStart): void {}

export function handleRetractEnd(event: RetractEnd): void {}

export function handleRetractStart(event: RetractStart): void {}

export function handleSetAdmin(event: SetAdmin): void {
  const kandel = KandelEntity.load(event.address)!;

  kandel.admin = event.params.admin;

  kandel.save();
}

export function handleSetCompoundRates(event: SetCompoundRates): void {}

export function handleSetGasprice(event: SetGasprice): void {
  const kandel = KandelEntity.load(event.address)!;

  kandel.gasprice = event.params.value;

  kandel.save();
}

export function handleSetGasreq(event: SetGasreq): void {
  const kandel = KandelEntity.load(event.address)!

  kandel.gasreq = event.params.value;

  kandel.save();
}

export function handleSetGeometricParams(event: SetGeometricParams): void {
  const kandel = KandelEntity.load(event.address)!;

  kandel.spread = event.params.spread;
  kandel.ratio = event.params.ratio;

  kandel.save();
}

export function handleSetIndexMapping(event: SetIndexMapping): void {

}

export function handleSetLength(event: SetLength): void {
  const kandel = KandelEntity.load(event.address)!;

  kandel.length = event.params.value;

  kandel.save();
}

export function handleSetReserveId(event: SetReserveId): void {
  const kandel = KandelEntity.load(event.address)!;

  kandel.reserveId = event.params.reserveId;

  kandel.save();
}

export function handleSetRouter(event: SetRouter): void {
  const kandel = KandelEntity.load(event.address)!;

  kandel.router = event.params.router;

  kandel.save();
}
