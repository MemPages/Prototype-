# Database (DEMO DATA, fictional)
```mermaid
erDiagram
  HOSPITAL ||--o{ DOCTOR : employs
  SPECIALTY ||--o{ DOCTOR : "name match"
  HOSPITAL { text id PK  text name  text name_ar  text city  text address  json specialties  bool emergency_available }
  DOCTOR { text id PK  text name  text name_ar  text specialty  text specialty_ar  text hospital_id FK  text city  json languages  int years_experience  bool available  text bio }
  SPECIALTY { text id PK  text name  text name_ar  text description  text keywords  bool screen_first }
```
Seed is `INSERT OR IGNORE` (idempotent, non-destructive). Array columns are JSON text in SQLite; use `text[]`/join tables in Postgres (`prisma/schema.prisma`, unverified).
