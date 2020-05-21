//! --------------------------------------------------------------------------------------------------------------------
//! atdis-request | https://github.com/eth-p/node-atdis | MIT License | Copyright (C) 2020 eth-p
//! --------------------------------------------------------------------------------------------------------------------
import {RequestPool} from "./request-pool";

// ---------------------------------------------------------------------------------------------------------------------

/**
 * An error that causes the {@link RequestPool request pool} to throttle its workers.
 * This can be used to respect rate limiting errors returned by an API.
 */
export class ThrottleError {

	/**
	 * The date to throttle until.
	 */
	public until: Date;

	public constructor(options: ThrottleOptions) {
		this.until = options.until;
	}

}

export interface ThrottleOptions {

	/**
	 * The date to throttle until.
	 */
	until: Date;
}

/**
 * Functions that handle throttling a request pool.
 */
export interface ThrottlePolicy<Throttle extends ThrottleError> {

	/**
	 * Called when a request pool should be throttled.
	 *
	 * @param throttle The throttle information.
	 * @param pool The pool to throttle.
	 */
	throttle(throttle: Throttle, pool: RequestPool<Throttle>): void;

}
