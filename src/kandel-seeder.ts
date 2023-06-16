import {
  NewAaveKandel,
  NewKandel
} from "../generated/KandelSeeder/KandelSeeder"
import { Kandel } from "../generated/templates"
import { Kandel as KandelEntity } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";

export function handleNewAaveKandel(event: NewAaveKandel): void {

}

export function handleNewKandel(event: NewKandel): void {
  // Registres the specific kandel instance, so that we will listen to its events
  Kandel.create(event.params.kandel);

  const kandel = new KandelEntity(event.params.kandel);

  kandel.transactionHash = event.transaction.hash;
  kandel.seeder = event.address;
  kandel.address = event.params.kandel;
  kandel.base = event.params.base;
  kandel.quote = event.params.quote;

  kandel.depositedBase = BigInt.fromI32(0);
  kandel.depositedQuote = BigInt.fromI32(0);

  kandel.totalBase = BigInt.fromI32(0);
  kandel.totalQuote = BigInt.fromI32(0);

  kandel.deployer = event.params.owner;
  kandel.admin = event.params.owner;

  kandel.save();
}
