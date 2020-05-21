//! --------------------------------------------------------------------------------------------------------------------
//! atdis-request-http | https://github.com/eth-p/node-atdis | MIT License | Copyright (C) 2020 eth-p
//! --------------------------------------------------------------------------------------------------------------------

/**
 * A request body.
 */
export class HttpBody<T = unknown> {

	/**
	 * The data.
	 */
	public readonly data: T;

	/**
	 * The content type.
	 */
	public readonly type: string;

	/**
	 * Creates a new request body.
	 *
	 * @param data The raw body data.
	 * @param type The content type. Defaults to text/plain.
	 */
	public constructor(data: any, type?: string) {
		this.data = data;
		this.type = type ?? "text/plain";
	}

	/**
	 * Encodes the data as an {@link ArrayBuffer}.
	 */
	public encode(): ArrayBuffer {
		if (HttpBody.isBuffer(this.data)) {
			return HttpBody.bufferToBuffer(this.data);
		}

		// Get the data as a string.
		const str: string = this.data == null
			? typeof this.data
			: (typeof (this.data as any).toString === 'function'
					? (this.data as any).toString()
					: JSON.stringify(this.data)
			);

		// Return the string as a buffer.
		return HttpBody.stringToBuffer(str);
	}

	/**
	 * Converts the data to a string.
	 * If a buffer was provided, it will convert the buffer to base64.
	 */
	public toString() {
		if (HttpBody.isBuffer(this.data)) {
			const global = getGlobal();
			
			if (global.Buffer != null) {
				// NodeJS
				return Buffer.from(this.data).toString('base64');
			} else {
				// Browser
				const buffer = Array.from(new Uint8Array(HttpBody.bufferToBuffer(this.data)));
				return btoa(buffer.map(b => String.fromCharCode(b)).join());
			}
		}

		return (typeof (this.data as any).toString === 'function')
			? (this.data as any).toString()
			: JSON.stringify(this.data);
	}

	/**
	 * Converts a UTF-8 string to a buffer.
	 * @param str The string to convert.
	 * @returns A buffer with the UTF-8 encoded string.
	 */
	protected static stringToBuffer(str: string): ArrayBuffer {
		const encoder = new TextEncoder();
		return encoder.encode(str);
	}

	/**
	 * Converts various forms of buffers into an ArrayBuffer.
	 * @param buffer The original buffer.
	 * @returns The corresponding ArrayBuffer.
	 */
	protected static bufferToBuffer(buffer: ArrayBuffer | any): ArrayBuffer {
		if (buffer instanceof ArrayBuffer) return buffer;
		return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
	}

	/**
	 * Checks if an object is a buffer.
	 * @param object The object.
	 * @returns `true` if the object is a buffer.
	 */
	protected static isBuffer(object: any): boolean {
		if (object instanceof ArrayBuffer) return true;

		const global = getGlobal();
		return global.Buffer != null && object instanceof global.Buffer;
	}

}

export namespace HttpBody {

	/**
	 * A JSON request body.
	 */
	export class Json<T = any> extends HttpBody<T> {

		/**
		 * Creates a new JSON request body.
		 * @param json The JSON data.
		 */
		public constructor(json: T) {
			super(json, 'application/json');
		}

		public encode(): ArrayBuffer {
			return HttpBody.stringToBuffer(JSON.stringify(this.data));
		}
		
		public toString(): string {
			return JSON.stringify(this.data);
		}
	}

	/**
	 * URL parameter request body.
	 */
	export class Params extends HttpBody<URLSearchParams> {

		/**
		 * Creates a new URL parameter request body.
		 * @param params The URL parameters.
		 */
		public constructor(params: URLSearchParams | { [key: string]: string }) {
			super(params instanceof URLSearchParams ? params : new URLSearchParams(params), 'application/x-www-form-urlencoded');
		}

		public encode(): ArrayBuffer {
			return HttpBody.stringToBuffer(this.data.toString());
		}
		
		public toString(): string {
			return this.data.toString();
		}
	}

}

/**
 * A function that returns the global variable.
 */
const getGlobal = Function('return this');
