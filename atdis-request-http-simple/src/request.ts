//! --------------------------------------------------------------------------------------------------------------------
//! atdis-request-http | https://github.com/eth-p/node-atdis | MIT License | Copyright (C) 2020 eth-p
//! --------------------------------------------------------------------------------------------------------------------
import {HttpHeaders} from "./headers";
import {HttpMethod} from "./method";
import {HttpBody} from "./body";

import type {RequestOptions} from "atdis-request";
import {Request, ThrottleError} from "atdis-request";

import type {Headers, Response} from "node-fetch";
import fetch from "node-fetch";

// ---------------------------------------------------------------------------------------------------------------------

/**
 * A HTTP/HTTPS request.
 * This uses {@link fetch} internally.
 */
export class HttpRequest extends Request<Response> {
	public readonly key: string;
	
	/**
	 * The default delay to use when one couldn't be determined from the headers.
	 */
	private static DEFAULT_DELAY = 5000;

	/**
	 * The request method.
	 */
	public readonly method: HttpMethod;

	/**
	 * The request URL.
	 */
	public readonly url: URL;

	/**
	 * The request body.
	 */
	public readonly body: null | HttpBody;

	/**
	 * The request headers.
	 */
	public readonly headers: HttpHeaders;

	/**
	 * Creates a new request.
	 * @param options The request options.
	 */
	public constructor(options: HttpRequestOptions) {
		super(options);
		const headers = options.headers ?? new HttpHeaders();

		this.url = options.url instanceof URL ? options.url : new URL(options.url);
		this.method = options.method ?? HttpMethod.GET;
		this.headers = headers instanceof HttpHeaders ? headers : new HttpHeaders(headers);
		this.body = options.body ?? null;
		
		// Create the cache key.
		this.key = 'http-simple:' + JSON.stringify({
			method: this.method,
			headers: this.headers.toObject(),
			url: this.url,
			body: this.body.toString(),
		})
	}

	public async run(): Promise<Response> {
		const response = await this._fetch();
		const status = response.status;

		if (status !== 200) {
			const delay = this._findDelay(response) ?? (this._isLimited(response) ? new Date(Date.now() + Object.getPrototypeOf(this).constructor.DEFAULT_DELAY) : null);

			// If it's rate-limited, throw a throttle error.
			if (delay != null) {
				throw new ThrottleError({
					until: delay
				});
			}

			// Otherwise, throw the failed request response.
			throw response;
		}

		return response;
	}

	/**
	 * Checks if the failed request should be rate limited.
	 * @param response The response object.
	 * @returns `true` if the response should be considered rate-limited.
	 */
	protected _isLimited(response: Response): boolean {
		const status = response.status;

		switch (status) {
			case 404:
				return false;

			case 429: // Too Many Requests
				return true;
		}

		return ((status % 100) === 4)
			|| ((status % 100) === 5);
	}

	/**
	 * Finds the date when requests should be resumed.
	 * @param response The response object.
	 * @returns The date, or undefined if it couldn't be found.
	 */
	protected _findDelay(response: Response): Date | undefined {
		const headers = response.headers;

		// Retry-After
		const retryAfter = headers.get("Retry-After");
		if (retryAfter != null) return this._findDate(retryAfter);

		// Remaining
		let remaining = this._findRatelimitHeader(headers, 'Remaining');
		let reset = this._findRatelimitHeader(headers, 'Reset');
		if (remaining != null && parseInt(remaining, 10) < 1) {
			return this._findDate(reset);
		}
	}

	/**
	 * Attempts to find a Date based on a string.
	 * This accepts date strings, epoch seconds, and epoch milliseconds.
	 *
	 * @param str The date string.
	 * @returns The date object.
	 */
	protected _findDate(str: string | undefined): undefined | Date {
		if (str === undefined) return undefined;

		// If it's a number, try to parse it as seconds or milliseconds since epoch.
		if (/^[0-9]+$/.test(str)) {
			const timestamp = parseInt(str, 10);
			const date = new Date(timestamp);

			// If the year is vastly off, it was likely provided as seconds since the epoch.
			if (Math.abs(new Date().getFullYear() - date.getFullYear()) > 1) {
				return new Date(timestamp * 1000);
			}

			return date;
		}

		// Try it as a date string.
		return new Date(str);
	}

	/**
	 * Finds a Rate-Limit header.
	 * This tries to detect the correct header.
	 *
	 * @param headers The headers.
	 * @param header The header to find.
	 * @returns The header value, or undefined if it couldn't be found.
	 */
	protected _findRatelimitHeader(headers: Headers, header: string): undefined | string {
		for (const prefix of ['Rate-Limit', 'RateLimit', 'X-Rate-Limit', 'X-RateLimit']) {
			const variants = [header];
			if (header.includes('-')) variants.push(header.replace('-', ''));
			for (const variant of variants) {
				const key = `${prefix}-${variant}`;
				const value = headers.get(key);
				if (value != null) return value;
			}
		}

		return undefined;
	}

	/**
	 * Generates the fetch request.
	 * If the method is GET, this will attempt to encode the body in the query string.
	 */
	protected _fetch(): Promise<Response> {
		let url = this.url;
		let body = this.body;

		if (body != null && this.method.toLowerCase() === HttpMethod.GET) {
			url = new URL(url.toString());

			if (body instanceof HttpBody.Params) {
				body.data.forEach(([k, v]) => {
					url.searchParams.append(k, v);
				});
			} else if (url.search === '') {
				url.search = `?${body.toString()}`;
			} else {
				url.search = `${url.search}&${body.toString()}`;
			}

			body = null;
		}

		return fetch(this.url, Object.assign({
			method: this.method.toUpperCase(),
			cache: 'no-cache',
			headers: this.headers.toObject(),
			redirect: 'follow'
		}, (body == null ? {} : {body})) as any);
	}

}

export interface HttpRequestOptions extends RequestOptions {

	/**
	 * The request method.
	 */
	method?: HttpMethod;

	/**
	 * The request headers.
	 */
	headers?: HttpHeaders | { [key: string]: string };

	/**
	 * The request URL.
	 */
	url: URL | string;

	/**
	 * The request body.
	 * If used with {@link HttpMethod.GET GET}, this will attempt to add the body to the query string.
	 */
	body: HttpBody;

}



