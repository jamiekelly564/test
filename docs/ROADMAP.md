# Next implementation backlog

## 1. Confirm the source-control and development loop

Publish the code to the separate private repository. Keep client assets out of Git. Verify a real PC browser, iPhone on trusted Wi-Fi and the restore procedure. Set up a review branch and require tests before merging. Do not change existing FireChecked repositories.

## 2. Harden the new free postcode preview

Version 0.2 adds source outline selection and automatic exterior geometry through Postcodes.io/Overpass, with optional GPT height assumptions. Next add a licensed address/UPRN service and production footprint/height provider. Show candidate addresses and confirm the building boundary. Maintain source, licence, capture date, coverage and accuracy metadata. Retain explicit public-data/user/AI/default height labels. Replace defaults with stronger height/terrain evidence when available; add roof geometry only from appropriate evidence. A postcode centroid is insufficient to select the property automatically. The current outline selection must be retained until a reliable address-to-building mapping exists. Never use the Marketfield interior as a result for another address. Keep bounded free usage and explicit no-data handling. Replace the shared public Overpass endpoint before a customer launch. Test real provider latency/coverage and physical mobile performance.

## 3. Add production identities and storage

Introduce organisations, users, roles, server-side per-building access, PostgreSQL migrations and private model/document storage. Provide local fixtures for development without real customer records. Move the front end to Next.js / TypeScript if required for the hosted architecture, retaining the existing model adapter and data contracts.

## 4. Survey operations

Turn locally saved scopes into approved quotes. Configure pricing after delivery-cost measurement. Add surveyor availability, explicit coverage, access attempts and evidence capture. Introduce reviewer sign-off, defects, reports and remedial verification as separately controlled records. Maintain the distinction between model provenance and inspection evidence.

## 5. Billing and entitlements

Integrate Stripe only after accounts and prices exist. Use server-verified webhooks, idempotency and entitlement checks. Separate capture-package purchases from ongoing software access. Do not hide purchased findings or urgent outcomes when a subscription is downgraded. Do not collect money through the current mock package flow.

## 6. Model capture and AI

Add plan/scan ingestion jobs with clear review states. Preserve coordinate systems, units and source transforms. Review automatic geometry before publishing. The current optional GPT adapter suggests missing exterior heights only. Add source-linked retrieval of actual records, not unsupported compliance verdicts or predictive-maintenance guarantees.

## 7. FireChecked integration

Define authorised API exchange for fire-door identities, evidence, inspections and work orders. Avoid cloning existing client records into a public test database. Keep FireChecked's operational apps unchanged until an explicit integration is scoped and reviewed.
