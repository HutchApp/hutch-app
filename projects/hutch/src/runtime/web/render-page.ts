import { Base } from "./base.component";
import { type BannerStateSource, bannerStateFromRequest } from "./banner-state";
import type { Component } from "./component.types";
import type { PageBody } from "./page-body.types";

export function renderPage(req: BannerStateSource, body: PageBody): Component {
	return Base(body, bannerStateFromRequest(req));
}
