import {
	BANNER_AREA_STYLES,
	BASE_CSS_VARIABLES,
	BASE_RESET_STYLES,
	FOOTER_STYLES,
	HEADER_STYLES,
	NAV_STYLES,
	OFFLINE_BANNER_STYLES,
	POC_BANNER_STYLES,
	UTILITY_STYLES,
} from "./base.styles";
import type { Component } from "./component.types";
import { render } from "./render";

export interface SeoMetadata {
	title: string;
	description: string;
	canonicalUrl: string;
	ogImage?: string;
	twitterImage?: string;
	ogType?: "website" | "article";
	robots?: string;
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
}

const HEADER_TEMPLATE = `
  <header class="header{{#if transparent}} header--transparent{{/if}}">
    <div class="header__content">
      <a href="/" class="header__brand">Hutch</a>
      <nav class="nav">
        <button class="nav__toggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="nav-menu">
          <span class="nav__toggle-bar"></span>
          <span class="nav__toggle-bar"></span>
          <span class="nav__toggle-bar"></span>
        </button>
        <div id="nav-menu" class="nav__menu">
          <ul class="nav__list">
            {{#if isAuthenticated}}
            <li><a href="/queue" class="nav__link" data-test-nav-item="queue">Queue</a></li>
            <li><a href="/export" class="nav__link" data-test-nav-item="export">Export</a></li>
            <li>
              <form method="POST" action="/logout" style="display:inline">
                <button type="submit" class="nav__link" style="background:none;border:none;cursor:pointer;font:inherit" data-test-nav-item="logout">Sign out</button>
              </form>
            </li>
            {{else}}
            <li><a href="/#what-works" class="nav__link" data-test-nav-item="features">Features</a></li>
            <li><a href="/#pricing" class="nav__link" data-test-nav-item="pricing">Pricing</a></li>
            <li><a href="/login" class="nav__link" data-test-nav-item="login">Sign in</a></li>
            {{/if}}
          </ul>
        </div>
      </nav>
    </div>
  </header>`;

function renderHeader(
	variant: "default" | "transparent",
	isAuthenticated: boolean,
): string {
	return render(HEADER_TEMPLATE, {
		transparent: variant === "transparent",
		isAuthenticated,
	});
}

const FOOTER_TEMPLATE = `
  <footer class="footer">
    <div class="footer__content">
      <ul class="footer__links">
        <li><a href="/privacy" class="footer__link">Privacy</a></li>
        <li><a href="/terms" class="footer__link">Terms</a></li>
      </ul>
      <p class="footer__copyright">&copy; {{year}} Hutch. Made in Australia.</p>
    </div>
  </footer>`;

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

const BASE_TEMPLATE = `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <meta name="description" content="{{description}}">
  <meta name="robots" content="{{robots}}">
  <link rel="canonical" href="{{canonicalUrl}}">
  <meta name="theme-color" content="#2B3A55" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#121212" media="(prefers-color-scheme: dark)">

  <meta property="og:type" content="{{ogType}}">
  <meta property="og:site_name" content="Hutch">
  <meta property="og:title" content="{{title}}">
  <meta property="og:description" content="{{description}}">
  <meta property="og:url" content="{{canonicalUrl}}">
  {{#if ogImage}}
  <meta property="og:image" content="{{ogImage}}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  {{/if}}
  <meta property="og:locale" content="en_AU">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{{title}}">
  <meta name="twitter:description" content="{{description}}">
  {{#if twitterImage}}<meta name="twitter:image" content="{{twitterImage}}">{{/if}}
  <meta name="twitter:creator" content="@fagnerbrack">

  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
  <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">

  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="apple-touch-icon" sizes="57x57" href="/apple-touch-icon-57x57.png">
  <link rel="apple-touch-icon" sizes="60x60" href="/apple-touch-icon-60x60.png">
  <link rel="apple-touch-icon" sizes="72x72" href="/apple-touch-icon-72x72.png">
  <link rel="apple-touch-icon" sizes="76x76" href="/apple-touch-icon-76x76.png">
  <link rel="apple-touch-icon" sizes="114x114" href="/apple-touch-icon-114x114.png">
  <link rel="apple-touch-icon" sizes="120x120" href="/apple-touch-icon-120x120.png">
  <link rel="apple-touch-icon" sizes="144x144" href="/apple-touch-icon-144x144.png">
  <link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon-152x152.png">
  <link rel="apple-touch-icon" sizes="167x167" href="/apple-touch-icon-167x167.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180x180.png">

  <link rel="manifest" href="/site.webmanifest">

  <meta name="msapplication-TileColor" content="#2B3A55">
  <meta name="msapplication-TileImage" content="/mstile-150x150.png">
  <meta name="msapplication-config" content="/browserconfig.xml">

  {{{structuredDataScript}}}

  <style>
    {{{baseStyles}}}
    {{{resetStyles}}}
    {{{utilityStyles}}}
    {{{bannerAreaStyles}}}
    {{{headerStyles}}}
    {{{navStyles}}}
    {{{footerStyles}}}
    {{{offlineBannerStyles}}}
    {{{pocBannerStyles}}}
    {{{pageStyles}}}
  </style>
</head>
<body{{#if bodyClass}} class="{{bodyClass}}"{{/if}}>
  <div class="banner-area">
    <div class="poc-banner" role="status">In Development</div>
    <div class="offline-banner" role="alert" aria-live="polite" aria-hidden="true">
      You're offline. Some features may be unavailable.
    </div>
  </div>
  <script>
    (function() {
      var ba = document.querySelector('.banner-area');
      if (ba) document.documentElement.style.setProperty('--banner-area-height', ba.offsetHeight + 'px');
    })();
  </script>
  {{{header}}}
  {{{content}}}
  {{{footer}}}
  {{{navScript}}}
  {{{offlineScript}}}
  {{{scripts}}}
</body>
</html>`;

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
		title: seo.title,
		description: seo.description,
		canonicalUrl: seo.canonicalUrl,
		ogType,
		ogImage: seo.ogImage,
		twitterImage: seo.twitterImage ?? seo.ogImage,
		robots,
		structuredDataScript: renderStructuredData(seo.structuredData),
		baseStyles: BASE_CSS_VARIABLES,
		resetStyles: BASE_RESET_STYLES,
		utilityStyles: UTILITY_STYLES,
		bannerAreaStyles: BANNER_AREA_STYLES,
		headerStyles: HEADER_STYLES,
		navStyles: NAV_STYLES,
		footerStyles: FOOTER_STYLES,
		offlineBannerStyles: OFFLINE_BANNER_STYLES,
		pocBannerStyles: POC_BANNER_STYLES,
		pageStyles: page.styles,
		bodyClass: page.bodyClass,
		header: renderHeader(headerVariant, page.isAuthenticated ?? false),
		content: page.content,
		footer: renderFooter(),
		navScript: NAV_SCRIPT,
		offlineScript: OFFLINE_INDICATOR_SCRIPT,
		scripts: page.scripts,
	});
}

export function Base(page: PageContent): Component {
	return {
		to: () => ({
			statusCode: 200,
			body: renderBaseTemplate(page),
		}),
	};
}
