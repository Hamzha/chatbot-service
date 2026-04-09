# Business Owner Use Case: Inventory-Fed AI Chatbot for WhatsApp and Website

## Use Case Summary

A business owner uploads or connects product, pricing, and stock data. The AI chatbot uses this data to answer customer questions on:

- WhatsApp
- Website chat widget

Example customer questions:

- "Is Product X in stock?"
- "What is the price of Model Y?"
- "Do you deliver to Karachi/Lahore/etc.?"
- "Suggest alternatives under my budget."

## How It Works (Business Flow)

1. Owner signs up and creates a workspace.
2. Owner connects inventory source:
   - CSV/Excel upload
   - Google Sheet
   - POS/ERP/API integration
3. Platform validates and indexes inventory data.
4. Owner connects channels:
   - WhatsApp Business API
   - Website chat widget
5. Customers ask questions.
6. AI retrieves live catalog context and responds.
7. If confidence is low, chat is handed to a human agent.

## Data Required from Business Owner

Minimum required fields:

- SKU or Product ID
- Product name
- Category
- Price
- Currency
- Quantity available
- Availability status
- Last updated timestamp

Optional but useful fields:

- Product description
- Attributes (size, color, material)
- Discount/promotions
- Region-wise availability
- Delivery ETA

## Recommended Architecture

- Ingestion Layer:
  - Upload parser for CSV/Excel
  - API connectors for ERP/POS
- Processing Layer:
  - Data cleaning and schema mapping
  - Validation rules and error reports
- Knowledge + Retrieval Layer:
  - Structured store for inventory facts
  - Vector index for product descriptions and FAQs
  - Hybrid retrieval (structured lookup + semantic search)
- Response Layer:
  - LLM prompt with inventory constraints
  - Guardrails against hallucination
- Channel Layer:
  - WhatsApp webhook and messaging API
  - Website widget SDK
- Admin Layer:
  - Dashboard for logs, analytics, and fallback tickets

## Response Strategy for Accuracy

- Always prioritize structured stock/price lookup before free-text generation.
- Include freshness checks based on `last_updated`.
- If item not found, return nearest alternatives.
- If confidence is low, do not guess; escalate to agent.

## Example Prompt Policy

System rules for inventory answers:

- Never invent stock levels.
- Use only verified inventory records.
- Mention when data may be outdated.
- Suggest alternatives when exact match is unavailable.

## WhatsApp and Website Setup Plan

### WhatsApp

1. Register WhatsApp Business account.
2. Configure webhook endpoint in backend.
3. Map incoming message to tenant workspace.
4. Run retrieval + response pipeline.
5. Send response via WhatsApp API.

### Website

1. Provide embeddable widget script for each tenant.
2. Authenticate widget with tenant token.
3. Route messages to same retrieval engine.
4. Show handoff option to human support.

## Rollout Model

Phase 1 (MVP):

- CSV upload
- Website chatbot
- Basic stock and price queries

Phase 2:

- WhatsApp integration
- Google Sheets sync
- Handoff to human agent

Phase 3:

- ERP/POS direct integrations
- Smart recommendations
- Multilingual support

## Operational Considerations

- Multi-tenant isolation for each business owner
- Role-based access for admin and agents
- Encryption in transit and at rest
- Audit logs for business-critical responses
- Rate limits and abuse protection

## Commercialization Option for This Feature

- Starter Plan:
  - Website chatbot
  - 1 inventory source (CSV)
  - Monthly message limit
- Growth Plan:
  - WhatsApp + Website
  - 2 to 3 inventory connectors
  - Analytics and handoff
- Enterprise Plan:
  - Custom integrations
  - SLA and priority support
  - On-prem or private cloud deployment
