# Edu Wallet Hub

Build a complete, modern, responsive educational digital-product website called Edu Wallet.

1. PROJECT PURPOSE

Edu Wallet is an independent educational resource platform initially focused exclusively on IGNOU students.

The platform will sell and provide downloadable digital educational resources, primarily:

IGNOU Notes

Guess Papers

Assignment Guidance / Solved Assignment References

Exam Guides

Study Guides

Revision Material

Free Study Resources / Samples

The platform may expand to other examinations such as CA Foundation/CA Intermediate in the future, so the architecture must be designed to support additional categories and examinations without requiring a complete rebuild.

Edu Wallet is not affiliated with, endorsed by, or officially connected to IGNOU. This must be clearly stated in the website footer and relevant legal/about sections.

The website should feel like a legitimate, professional educational platform—not a generic template, flashy startup landing page, or unofficial government website.

2. BRAND IDENTITY

Brand name

Edu Wallet

Suggested tagline

Study Smart. Score Better.

Use this as the default tagline, but structure the branding so it can easily be changed later.

Brand personality

Academic

Trustworthy

Minimal

Professional

Student-focused

Clean

Affordable

Practical

Visual direction

Use a visual language inspired by serious academic and institutional websites, but DO NOT copy IGNOU's logo, emblem, typography, exact color palette, or visual identity.

Create an original logo concept for Edu Wallet.

The logo should combine an educational concept with the "wallet" idea, for example:

Open book + wallet/page

Book + document

Education + digital resource

Keep the logo simple enough to work as a favicon and mobile icon.

Colors

Use a professional academic palette.

Primary:

Deep navy / academic blue

Secondary:

White

Light grey

Very subtle blue-grey backgrounds

Accent:

A restrained green or teal may be used for success states and positive actions.

Avoid excessive gradients, neon colors, excessive shadows, or flashy effects.

The website should look trustworthy and readable.

3. DESIGN PHILOSOPHY

Create a minimal modern academic website.

Prioritize:

Excellent typography

Clear hierarchy

Large readable headings

Clean cards

Consistent spacing

Simple navigation

Strong but tasteful CTA buttons

Responsive layouts

Fast loading

Accessibility

Mobile-first design

Do not over-design the website.

Do not add unnecessary animations.

Use subtle hover states and micro-interactions only where they improve usability.

The website should look excellent on:

Android phones

iPhones

Tablets

Laptops

Desktop computers

4. WEBSITE STRUCTURE

Create the following pages:

Public pages

Home

Shop

Product Details

Free Resources

About Us

Contact

FAQ

Terms & Conditions

Privacy Policy

Refund Policy

Disclaimer

Account pages

Register

Login

There does NOT need to be a customer dashboard in version 1.

The account system exists primarily so customer information can be collected and associated with orders.

Admin

Create an admin area that is not publicly accessible.

Admin functionality should eventually include:

Add product

Edit product

Delete product

Upload product PDF

Upload preview/sample

Set original price

Set discounted price

Set product category

Set product description

Mark product as featured

Mark product as free

View orders

View customer information

View payment verification status

Mark order as fulfilled

Manage free resources

5. HOME PAGE

Create a polished homepage with the following structure.

Header

Logo:

Edu Wallet

Navigation:

Home

Shop

Free Resources

About

Contact

Right side:

Search icon / search

Login

Register

On mobile use a clean hamburger navigation.

Hero Section

Headline:

Study Smart. Score Better.

Supporting text:

Exam-focused notes, guess papers, assignment guidance and study resources designed for IGNOU students.

Primary CTA:

Explore Resources

Secondary CTA:

Free Resources

Add a subtle academic visual, such as:

digital documents

study papers

books

notes

Do NOT use fake student photos or stock imagery that makes the platform look generic.

6. TRUST / VALUE SECTION

Create a simple section explaining why students use Edu Wallet.

Possible cards:

Exam Focused

Resources organized around practical exam preparation.

Affordable

Low-cost digital resources designed for students.

Instant Access Process

Purchase confirmation and delivery handled through email/WhatsApp.

Student Friendly

Simple, straightforward resources without unnecessary complexity.

Do not make unsupported claims such as "trusted by 100,000 students."

Never invent statistics, testimonials, ratings, reviews, customers, sales numbers, or institutional partnerships.

7. PRODUCT CATEGORIES

Create a section titled:

Explore Edu Wallet

Cards:

Notes

Subject-wise notes and revision material.

Guess Papers

Exam-oriented practice and likely-topic guides.

Assignment Guidance

Original reference material and explanations designed to help students understand and complete assignments.

Exam Guides

Focused preparation and revision resources.

Free Resources

Free samples and study material.

Each card should lead to the relevant Shop category or Free Resources section.

8. FEATURED PRODUCTS

Display a clean product-card grid.

Each card should contain:

Product cover

Product title

Course/program

Subject

Short description

Original price if applicable

Discounted price

Discount badge

"View Details" button

"Buy Now" button

Example:

IGNOU Guess Paper — [Subject]

Original:
₹80

Offer:
₹40

Badge:

50% OFF

Do not create fake products as if they are real.

Use clearly marked placeholder/demo products until actual products are entered through the admin panel.

9. SHOP PAGE

Create a clean product catalog.

At the top:

IGNOU Study Resources

Include a prominent search box:

Search notes, subjects, courses...

Search must work across:

Product name

Subject

Course

Category

Keywords

For version 1, DO NOT create complicated filters.

A simple category navigation can be provided:

All

Notes

Guess Papers

Assignment Guidance

Exam Guides

Free Resources

Use responsive product cards.

10. PRODUCT DETAIL PAGE

Each product must have a professional product page.

Include:

Product cover

Product title

Category

Course/program

Subject

Description

What's included

Format

Example:

Format: PDF

Number of pages

Allow this to be entered by the admin.

Preview

Provide a button:

Preview Sample

The sample should open a preview or downloadable sample where appropriate.

Pricing

Example:

₹80

₹40

50% OFF

CTA

Buy Now

Important information

Include:

This is a digital product. No physical item will be shipped.

For assignment resources, clearly state:

Edu Wallet provides original educational reference and guidance material. Students are responsible for understanding and submitting their own academic work in accordance with their institution's rules.

11. PURCHASE FLOW — VERSION 1

Do NOT integrate a complicated automatic payment gateway yet.

Use a simple manual UPI verification system.

The flow should be:

Student:

Creates an account

Opens a product

Clicks Buy Now

Sees the order/payment page

Sees Edu Wallet's UPI payment instructions

Sees a UPI QR code

Pays using their UPI application

Returns to Edu Wallet

Completes a payment confirmation form

The payment confirmation form should request:

Full name

Email address

WhatsApp number

Product

Amount paid

UPI transaction ID / UTR

Optional screenshot upload if technically supported

Confirmation checkbox

Button:

Submit Payment Confirmation

After submission:

Display:

Payment confirmation received.

Message:

We will verify your payment and deliver your digital product to your registered email address or WhatsApp number.

Do not automatically mark the order as paid merely because the customer submitted the form.

12. ORDER STATUS

Create order statuses:

Pending Payment

Payment Submitted

Payment Verified

Payment Rejected

Processing

Delivered

Cancelled

Admin should be able to change the status.

The customer should not have a full dashboard in version 1, but the system must store this information correctly in the backend.

13. ADMIN ORDER MANAGEMENT

Admin should see:

Order ID

Customer name

Email

WhatsApp

Product

Amount

Transaction ID

Payment status

Order status

Date/time

Admin actions:

Verify Payment

Reject Payment

Mark Delivered

Cancel Order

The admin interface should be simple and functional.

14. PRODUCT MANAGEMENT

Admin should be able to create a product with:

Product title

Slug

Description

Category

Course

Subject

Price

Discounted price

Discount percentage

Product cover

PDF file

Preview/sample file

Number of pages

Featured status

Free/paid status

Active/inactive status

Do not hard-code products into the frontend.

Products must be database-driven.

15. FREE RESOURCES

Create a dedicated Free Resources page.

Products/resources can be marked as free by the admin.

Each free resource should have:

Cover

Title

Description

Subject

Download/View button

Make this section useful as a marketing channel.

Use it to introduce students to Edu Wallet before they purchase paid resources.

16. ACCOUNT SYSTEM

Create:

Registration

Fields:

Full name

Email

Password

WhatsApp number

Login

Email

Password

Include:

Forgot password

Logout

Secure authentication

Use Supabase Authentication if available.

Do not expose passwords or sensitive authentication information.

17. DATABASE

Use Supabase or an equivalent backend.

Design the database cleanly.

Suggested tables:

users/profiles

id

full_name

email

whatsapp

created_at

products

id

title

slug

description

category

course

subject

price

discounted_price

discount_percentage

cover_image

pdf_file

preview_file

page_count

is_free

is_featured

is_active

created_at

updated_at

orders

id

user_id

product_id

amount

payment_method

transaction_id

payment_status

order_status

created_at

verified_at

delivered_at

categories

id

name

slug

description

free_resources

This may either be integrated into products using is_free, or implemented separately if technically cleaner.

18. FILE STORAGE

PDFs and other files must not be exposed unnecessarily through public URLs.

Use private storage where possible.

Separate:

Product PDFs

Preview PDFs

Product images

Design the system so secure/controlled downloads can be implemented later.

For version 1, the actual delivery may still be handled manually by the administrator through email/WhatsApp after payment verification.

Do not pretend that the website has automated secure delivery if it does not.

19. CONTACT PAGE

Include:

Contact Edu Wallet

Fields:

Name

Email

WhatsApp

Message

Also provide:

WhatsApp contact button

Email contact

Do not invent phone numbers or email addresses.

Create placeholders that can easily be replaced in one configuration area.

20. FAQ

Include useful questions such as:

What does Edu Wallet sell?

Edu Wallet provides digital educational resources such as notes, guess papers, exam guides and assignment reference material.

Are the products physical?

No. Products are digital resources, primarily in PDF format.

How do I pay?

Currently, payment is made through UPI using the payment instructions displayed during checkout.

How will I receive my product?

After payment verification, the purchased material will be delivered through the contact details provided during checkout, such as email or WhatsApp.

How long does delivery take?

Payment verification and delivery are handled manually. Display the actual estimated delivery time configured by the admin rather than making an unsupported promise.

Is Edu Wallet affiliated with IGNOU?

No. Edu Wallet is an independent educational resource platform and is not affiliated with or endorsed by IGNOU.

21. LEGAL PAGES

Create professional but editable:

Terms & Conditions

Privacy Policy

Refund Policy

Disclaimer

Important points:

Digital product policy

Clearly state that products are digital and no physical products are shipped.

Refunds

Do not promise unrestricted refunds for digital products.

Create a reasonable refund policy that can be edited by the site owner.

Academic disclaimer

State that Edu Wallet is an independent educational resource platform.

IGNOU disclaimer

Clearly state that Edu Wallet is not affiliated with, endorsed by, or officially connected to IGNOU.

Assignment disclaimer

Resources are intended for educational reference and guidance. Students remain responsible for complying with their institution's academic rules and submitting their own work.

Do not make legal claims that require jurisdiction-specific legal advice. Keep the policies editable.

22. FOOTER

Create a professional footer containing:

Edu Wallet

Study Smart. Score Better.

Navigation:

Home

Shop

Free Resources

About

Contact

FAQ

Legal:

Terms & Conditions

Privacy Policy

Refund Policy

Disclaimer

Social/contact icons where actual links are configured.

Include:

© 2026 Edu Wallet. All rights reserved.

And prominently:

Edu Wallet is an independent educational resource platform and is not affiliated with or endorsed by IGNOU.

23. SEARCH

The search box is mandatory.

It should allow students to type things such as:

BCOMG

Business Law

MCO

MCS

Assignment

Guess Paper

Economics

Show relevant matching products.

Create a clean empty state:

No resources found

with:

Try another search term.

24. MOBILE EXPERIENCE

The majority of students may access this website through mobile devices.

Therefore:

Mobile-first design

Large touch targets

Sticky but unobtrusive navigation

Responsive product cards

Easy-to-use payment instructions

QR code large enough to scan

Forms optimized for mobile

No horizontal scrolling

Fast page loading

The website must look excellent at approximately 360–430px screen widths.

25. SEO

Implement basic SEO.

Each page should have:

Proper title

Meta description

Open Graph metadata

Canonical URL where appropriate

Semantic HTML

Proper H1/H2 hierarchy

Descriptive image alt text

SEO-friendly product URLs

Example:

/shop/ignou-bcom-business-law-notes

Avoid keyword stuffing.

Create a sitemap and robots configuration if supported by the deployment environment.

26. PERFORMANCE

Prioritize performance.

Optimize images

Lazy-load images where appropriate

Avoid unnecessary JavaScript

Avoid huge animation libraries

Keep the homepage lightweight

Use modern responsive images

Avoid unnecessary API calls

The site should feel fast on mobile networks.

27. SECURITY

Implement reasonable security practices.

Secure authentication

Server-side authorization for admin functions

Never trust frontend payment status

Validate all forms

Sanitize user-generated content

Protect admin routes

Protect private product files

Do not expose secret API keys

Use environment variables for secrets

Implement Supabase Row Level Security where applicable

Only authorized admins should be able to:

Upload PDFs

Modify products

View customer information

Verify payments

Change order status

Never put service-role keys or payment secrets in client-side code.

28. ADMIN AUTHORIZATION

Create a secure admin role.

Normal users must not be able to access:

/admin

or any admin API/database operations.

Use role-based authorization.

Do not rely solely on hiding buttons in the frontend.

29. FUTURE-READY ARCHITECTURE

Although version 1 focuses only on IGNOU, design the data model so that future categories can be added.

For example:

Exam / Education Category
    ↓
Course / Program
    ↓
Subject
    ↓
Product


This should allow future expansion into:

CA Foundation

CA Intermediate

Other university courses

Competitive examinations

Professional certifications

Do NOT build all of these now.

Keep version 1 focused on IGNOU.

30. IMPORTANT UX RULES

Do not use:

Fake testimonials

Fake reviews

Fake customer counts

Fake sales numbers

Fake partnerships

Fake IGNOU affiliation

Fake payment confirmations

Fake product availability

Fake urgency

Do not use excessive:

Gradients

Glassmorphism

Floating animations

Giant rounded cards

Neon colors

Confetti

Popups

The website should feel trustworthy and mature.

31. DISCOUNT SYSTEM

The initial products should support discounted pricing.

For example:

Guess Paper:

Original price: ₹80

Discounted price: ₹40

Display:

50% OFF

Assignment reference:

Original price: ₹167

Discounted price: ₹100

Display:

40% OFF

However, prices must be database-driven and editable from the admin dashboard.

Do not hard-code these prices throughout the frontend.

32. CONFIGURATION

Create a central configuration area for:

Brand name

Tagline

Contact email

WhatsApp number

UPI ID

QR code

Social media links

Website URL

Copyright year

Do not scatter these values throughout the code.

33. EMPTY STATES

Every important page should have proper empty states.

Examples:

No products:

Resources are being added soon. Check back shortly.

No search results:

No resources found. Try another search term.

No free resources:

Free resources are coming soon.

No orders:

Do not show a customer dashboard in version 1, but keep the backend capable of supporting order history later.

34. ERROR HANDLING

Create professional error states for:

Failed login

Invalid registration

Payment confirmation failure

Invalid transaction ID

Missing required fields

Failed upload

Unauthorized admin access

Product unavailable

Server errors

Use understandable language.

Do not expose technical errors, database errors, stack traces, or API secrets to users.

35. ANALYTICS

Structure the website so analytics can be added later.

Track useful events such as:

Product viewed

Search performed

Buy Now clicked

Payment confirmation submitted

Free resource downloaded

Registration completed

Do not collect unnecessary personal information.

36. CONTENT RULES

All product descriptions should be professional and honest.

Do not claim:

"This guarantees passing."

"This guarantees high marks."

"100% accurate guess paper."

Instead use responsible wording such as:

"Exam-focused preparation material."

"Important topics and practice questions."

"Designed to support revision."

37. INITIAL PRODUCT DATA

Do not invent real educational products.

Create a small number of clearly labeled demo products only if required to demonstrate the interface.

Mark them internally as demo/placeholder data.

The admin must be able to replace them with real products.

38. TECHNICAL IMPLEMENTATION

Preferred stack:

React / modern frontend framework supported by Lovable

TypeScript

Tailwind CSS

Supabase for database/auth/storage

Responsive design

Component-based architecture

Use clean, maintainable code.

Avoid unnecessary dependencies.

Keep components reusable.

Use proper loading states and error states.

39. DEVELOPMENT ORDER

Build the project in this order:

Phase 1

Design system + global layout + navigation + footer.

Phase 2

Homepage.

Phase 3

Shop + product cards + search.

Phase 4

Product details.

Phase 5

Authentication.

Phase 6

Supabase database.

Phase 7

Admin dashboard.

Phase 8

Product management.

Phase 9

Order/payment-confirmation system.

Phase 10

Legal pages.

Phase 11

SEO + performance + accessibility.

Phase 12

Final testing.

Do not skip directly to complicated payment automation.

40. FINAL QUALITY STANDARD

Before considering the project complete, test:

Mobile layout

Desktop layout

Registration

Login

Logout

Search

Product pages

Free resources

Buy Now flow

UPI payment instructions

Payment confirmation form

Admin authentication

Product creation

Product editing

PDF upload

Order verification

Order status changes

Contact form

All navigation links

Legal pages

404 page

Loading states

Error states

Check for:

Broken links

Overflow

Poor mobile spacing

Incorrect prices

Console errors

Security issues

Exposed credentials

Unauthorized admin access

Fake placeholder content appearing as real content

FINAL DESIGN DIRECTION

The final result should feel like a real, trustworthy educational digital store.

Think:

Academic institution + modern digital marketplace

not:

generic AI-generated website.

Keep the interface minimal, professional, fast, readable and conversion-focused.

The most important goal of version 1 is:

A student should be able to discover an IGNOU resource, understand exactly what it contains, register, see the UPI payment instructions, submit payment confirmation, and receive the material manually after verification.

Build the application around that core workflow first.

Do not add unnecessary features merely to make the website look complicated.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://edu-wallet-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5a2b033c-198a-48c3-b1d9-f0530d11a1c2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
