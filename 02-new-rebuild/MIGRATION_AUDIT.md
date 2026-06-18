# Royal Engitech Migration Audit

## Repository structure observed

The repository contains a downloaded public copy of the old HTML website at the repository root. No private backend, PHP source, database, admin panel, hosting configuration or email-processing implementation was present. A new rebuild has been created separately in `02-new-rebuild`.

## Old pages found

- `index.html`
- `about-us.html`
- `products.html`
- `cnc-turned-parts.html`
- `aluminum-parts.html`
- `non-ferrous-castings-and-machined-parts.html`
- `cast-iron-castings-and-machined-parts.html`
- `sheet-metal-parts.html`
- `gears-and-timing-pulleys.html`
- `ground-shafts.html`
- `infrastructure.html`
- `work-shop.html`
- `fabrication-shop.html`
- `foundry-shop.html`
- `inquiry.php.html`
- `contact-us.html`

## CSS files found

- `stylesheet.css`
- `css/dg-picture-zoom.css`
- `engine/css/visuallightbox.css`
- `engine/css/vlightbox1.css`
- `engine1/style.css`
- `engine2/style.css`

## JavaScript files found

- `jquery.min.js`
- `jqueryslidemenu.js`
- `mootools-1.2.4-core-yc.js`
- `mootools-more.js`
- `dg-picture-zoom.js`
- `dg-picture-zoom-autoload.js`
- `engine/js/jquery.min.js`
- `engine/js/visuallightbox.js`
- `engine/js/vlbdata1.js`
- `engine1/jquery.js`
- `engine1/script.js`
- `engine1/wowslider.js`
- `engine2/jquery.js`
- `engine2/script.js`
- `engine2/wowslider.js`

## Image and asset folders found

- `data1/images`
- `data1/tooltips`
- `data2/images`
- `engine/images`
- root-level image files and referenced legacy image paths

## PDFs/downloadables found

- `ROYAL ENGITECH PVT. LTD. - ISO CERTIFICATE 2024.pdf`
- `royal-engitech-catalog.pdf`
- `brass-nrv.pdf`

## Extracted contact information

- Royal Engitech Pvt. Ltd.
- Address: 15, 16 & 17, Nimesh Estate, Nr. Amar Estate, Memco, Naroda Road, Ahmedabad – 380025, Gujarat, India
- Contact person: Mr. Sanket Panchal (Sales Department)
- Phone: +91-79-2220 0993 / 994
- Fax: +91-79-2220 4284
- Email: sales@royalengitech.com and info@royalengitech.com

## Extracted product/service content

- CNC Turned Parts
- Aluminum Parts
- Non Ferrous Castings And Machined Parts
- Cast Iron Castings And Machined Parts
- Sheet Metal Parts
- Rack, Pinion, Gears & Timing Pulleys
- Ground Shafts
- Brass Spring Non Return Valve PDF/product reference
- Workshop, fabrication shop and foundry shop capabilities

## Extracted industries served

- Textile machinery
- Power transmission
- Water pumps
- Valves
- Automobile
- Pharmaceutical
- Other industrial sectors

## Old forms and missing backend logic

The old public copy includes `inquiry.php.html`, a static downloaded representation of an inquiry page whose form posts back to `inquiry.php.html`. Fields include name, company, designation, company address, phone, mobile, email, message and file upload. The real PHP processing script, email sending code, file upload handling, validation, spam protection, database persistence and server configuration are not present in the repository. The rebuild therefore creates a new backend foundation from scratch and does not reuse legacy form logic.

## SEO metadata observed

All old HTML pages use the generic title `Royal Engitech Pvt. Ltd.`. No meaningful per-page meta descriptions were found in the old HTML files inspected.

## Preserve in rebuild

- Company name, tagline and credibility language
- Established year and ISO quality positioning
- Contact details
- Product/category taxonomy
- Industry taxonomy
- Infrastructure/workshop/fabrication/foundry capability information
- Downloadable catalog, ISO certificate and brass NRV PDF
- Legacy URLs through 301 redirects
