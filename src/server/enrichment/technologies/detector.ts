/**
 * =============================================================================
 * Technology Detection Engine
 * =============================================================================
 *
 * Detects technologies used by a company's website by analyzing HTML,
 * scripts, meta tags, headers, and cookies.
 *
 * Each technology has detection rules (regex patterns). The engine is
 * extensible — add a new technology to the array and it's automatically
 * detected.
 *
 * Categories:
 *  - frontend     (React, Vue, Angular, Svelte, etc.)
 *  - backend      (Laravel, Rails, Django, WordPress, etc.)
 *  - hosting      (Vercel, Netlify, AWS, Cloudflare, etc.)
 *  - database     (Supabase, Firebase, etc.)
 *  - analytics    (Google Analytics, Mixpanel, PostHog, Segment, etc.)
 *  - payments     (Stripe, Lemon Squeezy, Paddle, etc.)
 *  - auth         (Clerk, Auth0, etc.)
 *  - monitoring   (Sentry, etc.)
 *  - support      (Intercom, HubSpot, Crisp, etc.)
 * =============================================================================
 */

export interface TechnologyRule {
  name: string;
  slug: string;
  category: string;
  description?: string;
  /** Patterns to match in HTML — any match = detected */
  patterns: RegExp[];
  /** Confidence boost (0-1) when matched */
  confidence?: number;
}

export const TECHNOLOGY_RULES: TechnologyRule[] = [
  // Frontend frameworks
  { name: "React", slug: "react", category: "frontend", patterns: [/react(?:\.production|\.development)?\.min\.js/i, /data-reactroot/i, /__REACT_DEVTOOLS_GLOBAL_HOOK__/i] },
  { name: "Next.js", slug: "nextjs", category: "frontend", patterns: [/__NEXT_DATA__/i, /_next\/static\//i, /next\/dist/i] },
  { name: "Vue.js", slug: "vue", category: "frontend", patterns: [/vue(?:\.runtime)?\.min\.js/i, /data-v-[a-f0-9]/i, /__VUE_DEVTOOLS_GLOBAL_HOOK__/i] },
  { name: "Nuxt.js", slug: "nuxt", category: "frontend", patterns: [/__NUXT__/i, /_nuxt\//i, /window\.__NUXT__/i] },
  { name: "Angular", slug: "angular", category: "frontend", patterns: [/ng-version=/i, /angular(?:\.min)?\.js/i, /ng-app=/i, /_ngcontent-/i] },
  { name: "Svelte", slug: "svelte", category: "frontend", patterns: [/svelte-[a-z0-9]{6}/i, /__svelte/i] },
  { name: "SvelteKit", slug: "sveltekit", category: "frontend", patterns: [/__sveltekit/i, /svelte-kit/i] },
  { name: "Solid.js", slug: "solid", category: "frontend", patterns: [/solid-js/i, /data-hk=/i] },
  { name: "Gatsby", slug: "gatsby", category: "frontend", patterns: [/___gatsby/i, /gatsby-/i] },
  { name: "Remix", slug: "remix", category: "frontend", patterns: [/__remix/i, /window\.__remix/i] },
  { name: "Astro", slug: "astro", category: "frontend", patterns: [/astro-island/i, /data-astro/i] },
  { name: "Ember.js", slug: "ember", category: "frontend", patterns: [/ember\.js/i, /__ember/i] },
  { name: "Backbone.js", slug: "backbone", category: "frontend", patterns: [/backbone(?:\.min)?\.js/i] },
  { name: "jQuery", slug: "jquery", category: "frontend", patterns: [/jquery(?:-\d+\.\d+)?(?:\.min)?\.js/i, /jQuery v/i] },
  { name: "Bootstrap", slug: "bootstrap", category: "frontend", patterns: [/bootstrap(?:\.min)?\.(?:js|css)/i, /data-bs-/i] },
  { name: "Tailwind CSS", slug: "tailwind", category: "frontend", patterns: [/tailwind\.css/i, /tw-/i, /class="[^"]*\b(flex|grid|px-|py-|text-|bg-|w-|h-)/i] },
  { name: "Bulma", slug: "bulma", category: "frontend", patterns: [/bulma\.css/i] },

  // Backend frameworks
  { name: "Laravel", slug: "laravel", category: "backend", patterns: [/laravel_session/i, /x-powered-by:.*laravel/i, /csrf-token.*laravel/i] },
  { name: "Ruby on Rails", slug: "rails", category: "backend", patterns: [/csrf-token.*rails/i, /x-powered-by:.*phusion/i, /_rails/i] },
  { name: "Django", slug: "django", category: "backend", patterns: [/csrfmiddlewaretoken/i, /x-frame-options:.*django/i] },
  { name: "WordPress", slug: "wordpress", category: "backend", patterns: [/wp-content\//i, /wp-includes\//i, /wp-json\//i, /generator.*wordpress/i] },
  { name: "Drupal", slug: "drupal", category: "backend", patterns: [/drupal\.js/i, /generator.*drupal/i] },
  { name: "Ghost", slug: "ghost", category: "backend", patterns: [/ghost-url/i, /generator.*ghost/i] },
  { name: "Express.js", slug: "express", category: "backend", patterns: [/x-powered-by:.*express/i] },
  { name: "Fastify", slug: "fastify", category: "backend", patterns: [/x-powered-by:.*fastify/i] },
  { name: "NestJS", slug: "nestjs", category: "backend", patterns: [/x-powered-by:.*nest/i] },
  { name: "Spring Boot", slug: "spring", category: "backend", patterns: [/x-application-context:/i] },
  { name: "Phoenix", slug: "phoenix", category: "backend", patterns: [/x-powered-by:.*phoenix/i, /phoenix\.js/i] },

  // Hosting / CDN
  { name: "Vercel", slug: "vercel", category: "hosting", patterns: [/x-vercel-id/i, /x-vercel-cache/i, /vercel\./i] },
  { name: "Netlify", slug: "netlify", category: "hosting", patterns: [/x-netlify/i, /netlify\./i] },
  { name: "Cloudflare", slug: "cloudflare", category: "hosting", patterns: [/cf-ray/i, /__cfduid/i, /cf-browser-verification/i] },
  { name: "AWS", slug: "aws", category: "hosting", patterns: [/x-amz-cf-id/i, /x-amz-request-id/i, /amazonaws\.com/i] },
  { name: "CloudFront", slug: "cloudfront", category: "hosting", patterns: [/x-amz-cf-id/i, /cloudfront\./i] },
  { name: "Fly.io", slug: "fly", category: "hosting", patterns: [/fly-request-id/i, /fly\.dev/i] },
  { name: "Railway", slug: "railway", category: "hosting", patterns: [/x-railway/i] },
  { name: "Render", slug: "render", category: "hosting", patterns: [/render\.com/i, /x-render/i] },
  { name: "Heroku", slug: "heroku", category: "hosting", patterns: [/x-heroku/i, /herokuapp\.com/i] },
  { name: "GitHub Pages", slug: "github-pages", category: "hosting", patterns: [/github\.io/i, /x-github/i] },

  // Databases / BaaS
  { name: "Supabase", slug: "supabase", category: "database", patterns: [/supabase\.co/i, /supabase-js/i] },
  { name: "Firebase", slug: "firebase", category: "database", patterns: [/firebaseio\.com/i, /gtag.*firebase/i, /firebase-app\.js/i] },
  { name: "PlanetScale", slug: "planetscale", category: "database", patterns: [/planetscale/i] },
  { name: "Neon", slug: "neon", category: "database", patterns: [/neon\.tech/i] },
  { name: "Turso", slug: "turso", category: "database", patterns: [/turso\.tech/i] },

  // Analytics
  { name: "Google Analytics", slug: "google-analytics", category: "analytics", patterns: [/google-analytics\.com\/(ga|analytics)/i, /gtag\/js/i, /UA-\d+/i, /G-[A-Z0-9]+/i] },
  { name: "Google Tag Manager", slug: "gtm", category: "analytics", patterns: [/googletagmanager\.com\/gtm\.js/i, /GTM-[A-Z0-9]+/i] },
  { name: "Mixpanel", slug: "mixpanel", category: "analytics", patterns: [/mixpanel\.com/i, /mixpanel\.init/i] },
  { name: "PostHog", slug: "posthog", category: "analytics", patterns: [/posthog\.com/i, /posthog\.init/i] },
  { name: "Segment", slug: "segment", category: "analytics", patterns: [/segment\.com\/analytics\.js/i, /analytics\.load\(/i] },
  { name: "Amplitude", slug: "amplitude", category: "analytics", patterns: [/amplitude\.com/i, /amplitude\.init/i] },
  { name: "Hotjar", slug: "hotjar", category: "analytics", patterns: [/hotjar\.com/i, /hjid=/i] },
  { name: "Plausible", slug: "plausible", category: "analytics", patterns: [/plausible\.io/i] },
  { name: "Fathom", slug: "fathom", category: "analytics", patterns: [/fathom\.dns/i, /cdn\.usefathom/i] },
  { name: "Matomo", slug: "matomo", category: "analytics", patterns: [/matomo\.js/i, /_paq\.push/i] },
  { name: "Clicky", slug: "clicky", category: "analytics", patterns: [/clicky\.js/i, /static\.getclicky/i] },

  // Payments
  { name: "Stripe", slug: "stripe", category: "payments", patterns: [/js\.stripe\.com/i, /stripe\.com\/v3/i, /pk_live_/i, /pk_test_/i] },
  { name: "Lemon Squeezy", slug: "lemonsqueezy", category: "payments", patterns: [/lemonsqueezy\.com/i, /lmsqueezy/i] },
  { name: "Paddle", slug: "paddle", category: "payments", patterns: [/paddle\.com\/paddle\.js/i, /paddle_product/i] },
  { name: "RevenueCat", slug: "revenuecat", category: "payments", patterns: [/revenuecat\.com/i] },
  { name: "Chargebee", slug: "chargebee", category: "payments", patterns: [/chargebee\.com/i] },
  { name: "Recurly", slug: "recurly", category: "payments", patterns: [/recurly\.com/i] },

  // Authentication
  { name: "Clerk", slug: "clerk", category: "auth", patterns: [/clerk\.com/i, /clerk\.dev/i, /__clerk/i] },
  { name: "Auth0", slug: "auth0", category: "auth", patterns: [/auth0\.com/i, /auth0-js/i] },
  { name: "Firebase Auth", slug: "firebase-auth", category: "auth", patterns: [/firebaseauth/i, /firebase.*auth/i] },
  { name: "Stytch", slug: "stytch", category: "auth", patterns: [/stytch\.com/i] },
  { name: "Supabase Auth", slug: "supabase-auth", category: "auth", patterns: [/supabase.*auth/i] },
  { name: "NextAuth.js", slug: "nextauth", category: "auth", patterns: [/nextauth/i, /__nextauth/i] },
  { name: "WorkOS", slug: "workos", category: "auth", patterns: [/workos\.com/i] },

  // Monitoring / Error tracking
  { name: "Sentry", slug: "sentry", category: "monitoring", patterns: [/sentry-cdn\.com/i, /sentry\.io/i, /Sentry\.init/i] },
  { name: "Datadog", slug: "datadog", category: "monitoring", patterns: [/datadog/i, /datadog-log/i] },
  { name: "LogRocket", slug: "logrocket", category: "monitoring", patterns: [/logrocket\.com/i, /LogRocket\.init/i] },
  { name: "Bugsnag", slug: "bugsnag", category: "monitoring", patterns: [/bugsnag\.com/i, /bugsnag\.min\.js/i] },
  { name: "Rollbar", slug: "rollbar", category: "monitoring", patterns: [/rollbar\.com/i] },

  // Customer support / live chat
  { name: "Intercom", slug: "intercom", category: "support", patterns: [/intercom\.io/i, /intercomcdn/i] },
  { name: "HubSpot", slug: "hubspot", category: "support", patterns: [/hubspot/i, /js\.hs-scripts\.com/i] },
  { name: "Crisp", slug: "crisp", category: "support", patterns: [/crisp\.chat/i, /client\.crisp\.im/i] },
  { name: "Zendesk", slug: "zendesk", category: "support", patterns: [/zendesk\.com/i, /zdassets/i] },
  { name: "Drift", slug: "drift", category: "support", patterns: [/drift\.com/i, /driftt\.com/i] },
  { name: "Tawk.to", slug: "tawk", category: "support", patterns: [/tawk\.to/i] },
  { name: "LiveChat", slug: "livechat", category: "support", patterns: [/livechatinc\.com/i] },
  { name: "HelpScout", slug: "helpscout", category: "support", patterns: [/helpscout\.net/i] },

  // CMS
  { name: "Contentful", slug: "contentful", category: "cms", patterns: [/contentful\.com/i, /ctfassets\.net/i] },
  { name: "Sanity", slug: "sanity", category: "cms", patterns: [/sanity\.io/i, /cdn\.sanity\.io/i] },
  { name: "Strapi", slug: "strapi", category: "cms", patterns: [/strapi\.io/i, /strapi.*headless/i] },
  { name: "Prismic", slug: "prismic", category: "cms", patterns: [/prismic\.io/i] },
  { name: "Storyblok", slug: "storyblok", category: "cms", patterns: [/storyblok\.com/i] },
  { name: "Webflow", slug: "webflow", category: "cms", patterns: [/webflow\.com/i, /w-nav/i, /w-commerce/i] },
  { name: "Wix", slug: "wix", category: "cms", patterns: [/wix\.com/i, /wixstatic/i] },
  { name: "Squarespace", slug: "squarespace", category: "cms", patterns: [/squarespace\.com/i, /sqs-static/i] },

  // Email marketing
  { name: "Mailchimp", slug: "mailchimp", category: "email", patterns: [/mailchimp\.com/i, /mcjs/i] },
  { name: "ConvertKit", slug: "convertkit", category: "email", patterns: [/convertkit\.com/i] },
  { name: "Klaviyo", slug: "klaviyo", category: "email", patterns: [/klaviyo\.com/i, /kl_id/i] },
  { name: "Brevo", slug: "brevo", category: "email", patterns: [/brevo\.com/i, /sib-form/i] },
  { name: "Resend", slug: "resend", category: "email", patterns: [/resend\.com/i] },

  // A/B testing
  { name: "LaunchDarkly", slug: "launchdarkly", category: "testing", patterns: [/launchdarkly\.com/i] },
  { name: "Optimizely", slug: "optimizely", category: "testing", patterns: [/optimizely\.com/i] },
  { name: "Statsig", slug: "statsig", category: "testing", patterns: [/statsig\.com/i, /statsig\.init/i] },
  { name: "GrowthBook", slug: "growthbook", category: "testing", patterns: [/growthbook\.io/i] },

  // Other
  { name: "Vite", slug: "vite", category: "build", patterns: [/@vite\/client/i, /vite\/dist/i] },
  { name: "Webpack", slug: "webpack", category: "build", patterns: [/webpackChunk/i, /__webpack_require__/i] },
  { name: "Turbopack", slug: "turbopack", category: "build", patterns: [/@turbopack/i] },
  { name: "esbuild", slug: "esbuild", category: "build", patterns: [/esbuild/i] },
  { name: "SWC", slug: "swc", category: "build", patterns: [/swc/i] },

  // Fonts
  { name: "Google Fonts", slug: "google-fonts", category: "fonts", patterns: [/fonts\.googleapis\.com/i, /fonts\.gstatic\.com/i] },
  { name: "Font Awesome", slug: "fontawesome", category: "fonts", patterns: [/fontawesome/i, /fa-[a-z0-9-]+/i] },
  { name: "Inter Font", slug: "inter-font", category: "fonts", patterns: [/inter.*font/i, /font-inter/i] },

  // Icons
  { name: "Lucide Icons", slug: "lucide", category: "ui", patterns: [/lucide/i] },
  { name: "Heroicons", slug: "heroicons", category: "ui", patterns: [/heroicons/i] },

  // UI component libraries
  { name: "Radix UI", slug: "radix", category: "ui", patterns: [/radix-ui/i, /@radix/i] },
  { name: "shadcn/ui", slug: "shadcn", category: "ui", patterns: [/shadcn/i] },
  { name: "Headless UI", slug: "headlessui", category: "ui", patterns: [/headlessui/i] },
  { name: "Chakra UI", slug: "chakra", category: "ui", patterns: [/chakra-ui/i, /__chakra/i] },
  { name: "MUI", slug: "mui", category: "ui", patterns: [/mui/i, /material-ui/i] },
  { name: "Ant Design", slug: "antd", category: "ui", patterns: [/ant-design/i, /antd/i] },

  // Video
  { name: "Mux", slug: "mux", category: "video", patterns: [/mux\.com/i, /mux-video/i] },
  { name: "Cloudflare Stream", slug: "cf-stream", category: "video", patterns: [/cloudflarestream\.com/i] },
  { name: "YouTube", slug: "youtube", category: "video", patterns: [/youtube\.com\/embed/i, /youtu\.be/i] },
  { name: "Vimeo", slug: "vimeo", category: "video", patterns: [/vimeo\.com/i, /player\.vimeo/i] },

  // Search
  { name: "Algolia", slug: "algolia", category: "search", patterns: [/algolia\.net/i, /algoliasearch/i] },
  { name: "Elasticsearch", slug: "elasticsearch", category: "search", patterns: [/elastic\.co/i] },
  { name: "Meilisearch", slug: "meilisearch", category: "search", patterns: [/meilisearch\.com/i] },
  { name: "Typesense", slug: "typesense", category: "search", patterns: [/typesense\.org/i] },
];

export interface DetectedTechnology {
  name: string;
  slug: string;
  category: string;
  confidence: number;
}

/**
 * Detect technologies from HTML content.
 * Returns all matched technologies with confidence scores.
 */
export function detectTechnologies(html: string): DetectedTechnology[] {
  const detected: DetectedTechnology[] = [];
  const seen = new Set<string>();

  for (const rule of TECHNOLOGY_RULES) {
    if (seen.has(rule.slug)) continue;
    for (const pattern of rule.patterns) {
      if (pattern.test(html)) {
        seen.add(rule.slug);
        detected.push({
          name: rule.name,
          slug: rule.slug,
          category: rule.category,
          confidence: rule.confidence ?? 100,
        });
        break;
      }
    }
  }

  return detected;
}

/**
 * Get all registered technology rules (for the UI + seeding the database).
 */
export function getAllTechnologyRules(): TechnologyRule[] {
  return TECHNOLOGY_RULES;
}
