//! --------------------------------------------------------------------------------------------------------------------
//! atdis-request-http | https://github.com/eth-p/node-atdis | MIT License | Copyright (C) 2020 eth-p
//! --------------------------------------------------------------------------------------------------------------------

/**
 * A map of HTTP headers.
 */
export class HttpHeaders extends Map<string, string> {

	constructor(headers?: { [key: string]: string }) {
		super(...(headers == null ? [] : [Object.entries(headers)]));
	}

	/**
	 * Roughly converts the header to its appropriate capitalization.
	 * @param header The header string.
	 * @returns The captialized header string.
	 */
	protected _canonicalize(header: string) {
		return header.split('-')
			.map(part => part.substring(0, 1).toUpperCase() + part.substring(1).toLowerCase())
			.join('-');
	}

	/**
	 * Converts the headers to an object.
	 * @returns An object containing the headers.
	 */
	public toObject(): { [key: string]: string } {
		const obj: any = {};
		for (const [key, value] of this.entries()) {
			obj[key] = value;
		}
		return obj;
	}

	public toString(): string {
		return 'Headers ' + JSON.stringify(this.toObject());
	}

	// Map.

	public delete(key: string): boolean {
		return super.delete(this._canonicalize(key));
	}

	public get(key: string): string | undefined {
		return super.get(this._canonicalize(key));
	}

	public has(key: string): boolean {
		return super.has(this._canonicalize(key));
	}

	public set(key: string, value: string): this {
		return super.set(this._canonicalize(key), value);
	}
}
