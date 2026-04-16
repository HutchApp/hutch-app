/**
 * web-embed routes are now served by hutch's Lambda directly.
 * The API Gateway route override has been removed so /embed traffic
 * falls through to hutch's $default route.
 *
 * The Lambda resource and this Pulumi program will be destroyed
 * in a follow-up once the hutch /embed routes are verified in prod.
 */
