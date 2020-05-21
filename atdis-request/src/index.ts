//! --------------------------------------------------------------------------------------------------------------------
//! atdis | https://github.com/eth-p/node-atdis | MIT License | Copyright (C) 2020 eth-p
//! --------------------------------------------------------------------------------------------------------------------
export {Request, RequestOptions} from "./request";
export {RequestPool, RequestPoolOptions} from "./request-pool";
export {ThrottleError, ThrottlePolicy, ThrottleOptions} from "./throttle";

// Export policies.
import * as _Policy from "./throttle-policy";
export namespace ThrottlePolicies {
	export const Abstract = _Policy.AbstractPolicy;
	export const Suspend = _Policy.SuspendPolicy;
}
