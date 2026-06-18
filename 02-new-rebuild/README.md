# Royal Engitech Website Rebuild

Modern Next.js App Router rebuild for Royal Engitech Pvt. Ltd. The old downloaded public website files are reference-only and are not used as backend logic.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS design system
- Framer Motion animations
- Zod server-side validation
- API route backend for contact/product inquiries
- SMTP notification setup with environment variables
- PostgreSQL/Prisma-ready schema for optional lead persistence
- SEO metadata, Open Graph, sitemap, robots.txt and redirect mapping

## Local development

```bash
cd 02-new-rebuild
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

Required for email delivery:

```bash
NEXT_PUBLIC_SITE_URL=https://www.royalengitech.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=replace-me
SMTP_PASSWORD=replace-me
CONTACT_TO_EMAIL=sales@royalengitech.com
CONTACT_FROM_EMAIL=website@royalengitech.com
```

Optional database readiness:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/royal_engitech
SAVE_LEADS_TO_DATABASE=false
```

The contact API currently validates and sends notifications. To persist leads, install/configure Prisma Client, run migrations from `prisma/schema.prisma`, set `SAVE_LEADS_TO_DATABASE=true`, and add the save call in `src/app/api/contact/route.ts`.

## Backend behavior

The `/api/contact` route:

- accepts name, company name, email, phone, country, product/service interest and message;
- validates payloads server-side with Zod;
- rejects malformed JSON and validation failures with clear responses;
- includes a honeypot field named `website`;
- includes an in-memory rate-limit-ready foundation for abuse protection;
- sends SMTP notification emails when SMTP environment variables are configured;
- avoids hardcoded secrets.

## Deployment

1. Deploy `02-new-rebuild` as the application root on Vercel, Netlify with Next support, or a Node host.
2. Configure all production environment variables in the hosting dashboard.
3. Set `NEXT_PUBLIC_SITE_URL` to the final canonical HTTPS domain.
4. Configure SMTP credentials for a verified sending domain.
5. If using database persistence, provision PostgreSQL, run Prisma migrations, and wire the save call.
6. Verify redirects from legacy `.html` URLs.
7. Submit `/sitemap.xml` in Google Search Console after DNS cutover.

## Migration redirects

Redirects live in `next.config.ts` and cover the old public URLs discovered during audit, including `/index.html`, `/about-us.html`, `/products.html`, `/contact-us.html`, `/inquiry.php.html`, infrastructure/shop pages and product detail pages.
