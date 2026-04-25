import type { Request } from "express";
import { Base } from "./base.component";
import { bannerStateFromRequest } from "./banner-state";
import type { Component } from "./component.types";
import type { PageBody } from "./page-body.types";

export function renderPage(req: Request, body: PageBody): Component {
	return Base(body, bannerStateFromRequest(req));
}
