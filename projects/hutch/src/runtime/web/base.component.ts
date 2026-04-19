import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	BANNER_AREA_STYLES,
	BASE_CSS_VARIABLES,
	BASE_RESET_STYLES,
	FOOTER_STYLES,
	HEADER_STYLES,
	NAV_STYLES,
	OFFLINE_BANNER_STYLES,
	VERIFY_BANNER_STYLES,
	UTILITY_STYLES,
} from "./base.styles";
import type { Component } from "./component.types";
import { HtmlPage } from "./html-page";
import { render } from "./render";
import { getEnv, requireEnv } from "../require-env";

const HEADER_TEMPLATE = readFileSync(join(__dirname, "header.template.html"), "utf-8");
const FOOTER_TEMPLATE = readFileSync(join(__dirname, "footer.template.html"), "utf-8");
const BASE_TEMPLATE = readFileSync(join(__dirname, "base.template.html"), "utf-8");

export interface SeoMetadata {
	title: string;
	description: string;
	canonicalUrl: string;
	ogImage?: string;
	ogImageAlt?: string;
	ogImageType?: string;
	twitterImage?: string;
	twitterSite?: string;
	ogType?: "website" | "article";
	robots?: string;
	author?: string;
	keywords?: string;
	structuredData?: object[];
}

export interface PageContent {
	seo: SeoMetadata;
	styles: string;
	headerVariant?: "default" | "transparent";
	bodyClass?: string;
	content: string;
	scripts?: string;
	isAuthenticated?: boolean;
	emailVerified?: boolean;
}

function renderHeader(
	variant: "default" | "transparent",
	isAuthenticated: boolean,
): string {
	return render(HEADER_TEMPLATE, {
		transparent: variant === "transparent",
		isAuthenticated,
	});
}

function renderFooter(): string {
	return render(FOOTER_TEMPLATE, {
		year: new Date().getFullYear(),
	});
}

const NAV_SCRIPT = `
<script>
(function() {
  var toggle = document.querySelector('.nav__toggle');
  var menu = document.querySelector('.nav__menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', function() {
    var expanded = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!expanded));
    menu.classList.toggle('nav__menu--open', !expanded);
  });

  document.addEventListener('click', function(e) {
    var isToggleVisible = window.getComputedStyle(toggle).display !== 'none';
    if (isToggleVisible && !e.target.closest('.nav')) {
      toggle.setAttribute('aria-expanded', 'false');
      menu.classList.remove('nav__menu--open');
    }
  });
})();
</script>`;

const STATIC_BASE_URL = requireEnv("STATIC_BASE_URL");

const CANONICAL_ORIGIN = "https://readplace.com";

function normalizeCanonicalUrl(canonicalUrl: string): string {
	const url = new URL(canonicalUrl, CANONICAL_ORIGIN);
	return `${CANONICAL_ORIGIN}${url.pathname}${url.search}${url.hash}`;
}

const LIVERELOAD_SCRIPT = getEnv("LIVERELOAD")
	? `\n<script src="http://localhost:35729/livereload.js?snipver=1"></script>`
	: "";

const HTMX_SCRIPTS = `<script src="https://cdn.jsdelivr.net/npm/htmx.org@2.0.8/dist/htmx.min.js" integrity="sha384-/TgkGk7p307TH7EXJDuUlgG3Ce1UVolAOFopFekQkkXihi5u/6OCvVKyz1W+idaz" crossorigin="anonymous"></script><script>htmx.config.scrollBehavior='smooth';</script>`;

const OFFLINE_INDICATOR_SCRIPT = `
<script>
(function() {
  var banner = document.querySelector('.offline-banner');
  var bannerArea = document.querySelector('.banner-area');
  if (!banner || !bannerArea) return;

  var wasOffline = false;
  var hideTimeout = null;

  function updateBannerAreaHeight() {
    document.documentElement.style.setProperty(
      '--banner-area-height', bannerArea.offsetHeight + 'px'
    );
  }

  banner.addEventListener('transitionend', updateBannerAreaHeight);

  function updateOnlineStatus() {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }

    if (navigator.onLine) {
      if (wasOffline) {
        banner.textContent = 'Back online';
        banner.classList.add('offline-banner--visible');
        banner.setAttribute('aria-hidden', 'false');
        updateBannerAreaHeight();
        hideTimeout = setTimeout(function() {
          banner.classList.remove('offline-banner--visible');
          banner.setAttribute('aria-hidden', 'true');
        }, 2000);
      } else {
        banner.classList.remove('offline-banner--visible');
        banner.setAttribute('aria-hidden', 'true');
      }
      wasOffline = false;
    } else {
      wasOffline = true;
      banner.textContent = "You're offline. Some features may be unavailable.";
      banner.classList.add('offline-banner--visible');
      banner.setAttribute('aria-hidden', 'false');
      updateBannerAreaHeight();
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
})();
</script>`;

function renderStructuredData(data: object[] | undefined): string {
	if (!data || data.length === 0) return "";
	// SECURITY: JSON.stringify is safe for server-controlled data.
	// WARNING: Never interpolate user input into structured data objects.
	return data
		.map(
			(item) =>
				`<script type="application/ld+json">${JSON.stringify(item)}</script>`,
		)
		.join("\n  ");
}

function renderBaseTemplate(page: PageContent): string {
	const headerVariant = page.headerVariant || "default";
	const seo = page.seo;

	const ogType = seo.ogType || "website";
	const robots = seo.robots || "index, follow";

	return render(BASE_TEMPLATE, {
		staticBaseUrl: STATIC_BASE_URL,
		title: seo.title,
		description: seo.description,
		canonicalUrl: normalizeCanonicalUrl(seo.canonicalUrl),
		ogType,
		ogImage: seo.ogImage,
		ogImageAlt: seo.ogImageAlt,
		ogImageType: seo.ogImageType,
		twitterImage: seo.twitterImage ?? seo.ogImage,
		twitterSite: seo.twitterSite,
		robots,
		author: seo.author,
		keywords: seo.keywords,
		structuredDataScript: renderStructuredData(seo.structuredData),
		baseStyles: BASE_CSS_VARIABLES,
		resetStyles: BASE_RESET_STYLES,
		utilityStyles: UTILITY_STYLES,
		bannerAreaStyles: BANNER_AREA_STYLES,
		headerStyles: HEADER_STYLES,
		navStyles: NAV_STYLES,
		footerStyles: FOOTER_STYLES,
		offlineBannerStyles: OFFLINE_BANNER_STYLES,
		verifyBannerStyles: VERIFY_BANNER_STYLES,
		showVerificationBanner: page.isAuthenticated === true && page.emailVerified === false,
		pageStyles: page.styles,
		bodyClass: page.bodyClass,
		header: renderHeader(headerVariant, page.isAuthenticated ?? false),
		content: page.content,
		footer: renderFooter(),
		navScript: NAV_SCRIPT,
		offlineScript: OFFLINE_INDICATOR_SCRIPT,
		scripts: HTMX_SCRIPTS + (page.scripts ?? "") + LIVERELOAD_SCRIPT,
	});
}

export function Base(page: PageContent): Component {
	return HtmlPage(renderBaseTemplate(page));
}
