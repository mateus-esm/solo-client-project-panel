CREATE TABLE "admin_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"category" text DEFAULT 'entrada' NOT NULL,
	"display_category" text,
	"required" boolean DEFAULT false NOT NULL,
	"description" text,
	"file_url" text,
	"object_path" text,
	"uploaded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"installment_number" integer NOT NULL,
	"amount" real NOT NULL,
	"due_date" text NOT NULL,
	"paid_date" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"jestor_id" text,
	"client_name" text NOT NULL,
	"client_email" text NOT NULL,
	"client_phone" text,
	"system_power" real DEFAULT 0 NOT NULL,
	"status_step" integer DEFAULT 1 NOT NULL,
	"status_projeto" text,
	"stage" text DEFAULT 'onboarding' NOT NULL,
	"capex" real,
	"receita_bruta" real,
	"tracking_code" text,
	"tracking_carrier" text,
	"city" text DEFAULT '' NOT NULL,
	"state" text DEFAULT '' NOT NULL,
	"completion_percent" integer DEFAULT 0 NOT NULL,
	"estimated_activation" text,
	"notes" text,
	"estimated_date" text,
	"valor_projeto" real,
	"forma_de_pagamento" text,
	"observacoes_gerais" text,
	"data_inicio_prevista" text,
	"data_conclusao_prevista" text,
	"data_de_fechamento" text,
	"data_de_pagamento" text,
	"data_de_compras" text,
	"data_de_entrega_do_equipamento" text,
	"scheduling_link" text,
	"section_visibility" jsonb DEFAULT '{"payments":true,"scheduling":true,"tracking":true,"chat":true,"documents_cliente":true,"documents_engenharia":true,"documents_fiscal":true,"documents_legal":true,"documents_equipamentos":true}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projects_jestor_id_unique" UNIQUE("jestor_id")
);
--> statement-breakpoint
CREATE TABLE "scheduling_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"requested_date" text NOT NULL,
	"notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "service_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"kind" text DEFAULT 'imagens_documentacao' NOT NULL,
	"name" text,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"name" text NOT NULL,
	"tipo_servico" text,
	"valor_servico" real,
	"status" text DEFAULT 'Agendado' NOT NULL,
	"status_pagamento" text DEFAULT 'Pendente' NOT NULL,
	"pagamento_realizado" boolean DEFAULT false NOT NULL,
	"data_execucao" timestamp,
	"data_inicio" timestamp,
	"data_termino" timestamp,
	"equipe_execucao" text,
	"endereco" text,
	"responsavel_email" text,
	"observacoes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_checklist_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"stage" text NOT NULL,
	"checklist_slug" text NOT NULL,
	"label" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"done_by" text,
	"done_at" timestamp,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homologacao_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"technician_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "homologacao_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "homologacao_technicians" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "homologacao_technicians_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "IDX_checklist_project" ON "project_checklist_items" USING btree ("project_id");