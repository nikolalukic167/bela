/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as chat from "../chat.js";
import type * as crons from "../crons.js";
import type * as flags from "../flags.js";
import type * as http from "../http.js";
import type * as lib_accountLogic from "../lib/accountLogic.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_blocks from "../lib/blocks.js";
import type * as lib_chatLogic from "../lib/chatLogic.js";
import type * as lib_chatPolicy from "../lib/chatPolicy.js";
import type * as lib_config from "../lib/config.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_flags from "../lib/flags.js";
import type * as lib_log from "../lib/log.js";
import type * as lib_moderationLogic from "../lib/moderationLogic.js";
import type * as lib_names from "../lib/names.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_ratingLogic from "../lib/ratingLogic.js";
import type * as lib_tableLogic from "../lib/tableLogic.js";
import type * as maintenance from "../maintenance.js";
import type * as moderation from "../moderation.js";
import type * as ratings from "../ratings.js";
import type * as stats from "../stats.js";
import type * as tables from "../tables.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  chat: typeof chat;
  crons: typeof crons;
  flags: typeof flags;
  http: typeof http;
  "lib/accountLogic": typeof lib_accountLogic;
  "lib/auth": typeof lib_auth;
  "lib/blocks": typeof lib_blocks;
  "lib/chatLogic": typeof lib_chatLogic;
  "lib/chatPolicy": typeof lib_chatPolicy;
  "lib/config": typeof lib_config;
  "lib/errors": typeof lib_errors;
  "lib/flags": typeof lib_flags;
  "lib/log": typeof lib_log;
  "lib/moderationLogic": typeof lib_moderationLogic;
  "lib/names": typeof lib_names;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/ratingLogic": typeof lib_ratingLogic;
  "lib/tableLogic": typeof lib_tableLogic;
  maintenance: typeof maintenance;
  moderation: typeof moderation;
  ratings: typeof ratings;
  stats: typeof stats;
  tables: typeof tables;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
