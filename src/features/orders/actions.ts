"use server";

import { redirect } from "next/navigation";
import { LocalDataError } from "@/lib/json-store";
import { configurationMessage } from "../checkout/model";
import { allowRequest, checkoutBackend, signingKey } from "../checkout/server-config";
import { lookupErrorMessage, lookupLimitMessage, orderCodeSchema, orderPath, unknownOrder } from "./model";

export async function lookupOrder(_previous: string, form: FormData) {
  const backend = checkoutBackend();
  if (backend.mode === "unavailable") return configurationMessage;
  const code = orderCodeSchema.safeParse(form.get("code"));
  // The order page checks the quota for valid codes, including direct visits.
  if (code.success) redirect(orderPath(code.data));

  try {
    return await allowRequest(backend, await signingKey(backend), "lookup") ? unknownOrder : lookupLimitMessage;
  } catch (error) {
    return error instanceof LocalDataError ? error.message : lookupErrorMessage;
  }
}
