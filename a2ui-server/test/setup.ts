import { coreDb } from '../src/db/core/index.js';
import { foodDb } from '../src/db/food/index.js';
import { campusDb } from '../src/db/campus/index.js';
import { users, conversations, messages } from '../src/db/core/schema.js';
import { dishes, orders } from '../src/db/food/schema.js';
import { facilities, reservations, payments } from '../src/db/campus/schema.js';

export async function cleanDatabase() {
  // Clean in dependency order
  await coreDb.delete(messages);
  await coreDb.delete(conversations);
  await coreDb.delete(users);

  await foodDb.delete(orders);
  await foodDb.delete(dishes);

  await campusDb.delete(reservations);
  await campusDb.delete(payments);
  await campusDb.delete(facilities);
}
