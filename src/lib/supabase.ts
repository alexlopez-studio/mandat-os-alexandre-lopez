import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/**
 * Lazy Supabase clients.
 *
 * We do NOT instantiate `createClient` at module-import time, because Next.js
 * evaluates every API route module during the `Collecting page data` build
 * step. If the env vars are not present at build time (Vercel preview without
 * all secrets yet, local dev without `.env`, etc.) the `createClient` call
 * throws `supabaseKey is required` and the whole build fails.
 *
 * Instead we expose two Proxy objects that look and feel like a real
 * `SupabaseClient<Database>` to consumers, but only construct the underlying
 * client on the first property access. At that point we are already inside
 * a request handler, so env vars are guaranteed to be available.
 */

function makeClient(preferServiceRole: boolean): SupabaseClient<Database> {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL
	const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
	const service = process.env.SUPABASE_SERVICE_ROLE_KEY

	if (!url) {
		throw new Error(
			'[supabase] NEXT_PUBLIC_SUPABASE_URL is not set. Configure it in your Vercel project env vars.',
		)
	}

	const key = preferServiceRole ? (service ?? anon) : anon
	if (!key) {
		throw new Error(
			'[supabase] Missing Supabase key. Set NEXT_PUBLIC_SUPABASE_ANON_KEY (and SUPABASE_SERVICE_ROLE_KEY for admin routes).',
		)
	}

	return createClient<Database>(url, key)
}

let _supabase: SupabaseClient<Database> | null = null
let _supabaseAdmin: SupabaseClient<Database> | null = null

function getSupabase(): SupabaseClient<Database> {
	return (_supabase ??= makeClient(false))
}

function getSupabaseAdmin(): SupabaseClient<Database> {
	return (_supabaseAdmin ??= makeClient(true))
}

function lazyClient(getter: () => SupabaseClient<Database>): SupabaseClient<Database> {
	return new Proxy({} as SupabaseClient<Database>, {
		get(_target, prop) {
			const client = getter() as unknown as Record<string | symbol, unknown>
			const value = client[prop]
			return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value
		},
		has(_target, prop) {
			return prop in (getter() as unknown as object)
		},
	})
}

/** Client public — navigateur et SSR anonyme */
export const supabase: SupabaseClient<Database> = lazyClient(getSupabase)

/** Client service role — serveur uniquement (API routes) */
export const supabaseAdmin: SupabaseClient<Database> = lazyClient(getSupabaseAdmin)
