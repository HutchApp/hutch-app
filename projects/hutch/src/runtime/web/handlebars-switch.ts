import type Handlebars from "handlebars";

interface SwitchContext {
	__switch_value__?: unknown;
	__switch_matched__?: boolean;
}

type HelperThis = SwitchContext & Record<string, unknown>;

export const switchHelpers: Record<string, Handlebars.HelperDelegate> = {
	switch(this: HelperThis, value: unknown, options: Handlebars.HelperOptions) {
		this.__switch_value__ = value;
		this.__switch_matched__ = false;
		const result = options.fn(this);
		delete this.__switch_value__;
		delete this.__switch_matched__;
		return result;
	},
	case(this: HelperThis, value: unknown, options: Handlebars.HelperOptions) {
		if (value === this.__switch_value__) {
			this.__switch_matched__ = true;
			return options.fn(this);
		}
		return "";
	},
	default(this: HelperThis, options: Handlebars.HelperOptions) {
		if (!this.__switch_matched__) {
			return options.fn(this);
		}
		return "";
	},
};
