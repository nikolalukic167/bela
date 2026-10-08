/* eslint-disable */
  /**
   * Generated `api` utility.
   *
   * THIS CODE IS AUTOMATICALLY GENERATED.
   *
   * To regenerate, run `npx convex dev`.
   * @module
   */
  
  import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
  import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_config from "../lib/config.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_tableLogic from "../lib/tableLogic.js";
import type * as tables from "../tables.js";
import type * as users from "../users.js";

  /**
   * A utility for referencing Convex functions in your app's API.
   *
   * Usage:
   * ```js
   * const myFunctionReference = api.myModule.myFunction;
   * ```
   */
  declare const fullApi: ApiFromModules<{
    "admin": typeof admin,
"auth": typeof auth,
"http": typeof http,
"lib/auth": typeof lib_auth,
"lib/config": typeof lib_config,
"lib/errors": typeof lib_errors,
"lib/tableLogic": typeof lib_tableLogic,
"tables": typeof tables,
"users": typeof users,
  }>;
  export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
  export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
  