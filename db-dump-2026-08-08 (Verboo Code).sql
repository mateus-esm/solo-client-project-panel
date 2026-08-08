--
-- PostgreSQL database dump
--

\restrict 1M3rfp7jHQcd3Co0uHmpXyLChC91D8S6bimVz5aJgbYroef0o3o72UEEb9ZXfgR

-- Dumped from database version 16.14 (422d414)
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: _system; Type: SCHEMA; Schema: -; Owner: neondb_owner
--

CREATE SCHEMA _system;


ALTER SCHEMA _system OWNER TO neondb_owner;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: replit_database_migrations_v1; Type: TABLE; Schema: _system; Owner: neondb_owner
--

CREATE TABLE _system.replit_database_migrations_v1 (
    id bigint NOT NULL,
    build_id text NOT NULL,
    deployment_id text NOT NULL,
    statement_count bigint NOT NULL,
    applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE _system.replit_database_migrations_v1 OWNER TO neondb_owner;

--
-- Name: replit_database_migrations_v1_id_seq; Type: SEQUENCE; Schema: _system; Owner: neondb_owner
--

CREATE SEQUENCE _system.replit_database_migrations_v1_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE _system.replit_database_migrations_v1_id_seq OWNER TO neondb_owner;

--
-- Name: replit_database_migrations_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: _system; Owner: neondb_owner
--

ALTER SEQUENCE _system.replit_database_migrations_v1_id_seq OWNED BY _system.replit_database_migrations_v1.id;


--
-- Name: admin_sessions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.admin_sessions (
    id integer NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admin_sessions OWNER TO neondb_owner;

--
-- Name: admin_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.admin_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_sessions_id_seq OWNER TO neondb_owner;

--
-- Name: admin_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.admin_sessions_id_seq OWNED BY public.admin_sessions.id;


--
-- Name: documents; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.documents (
    id integer NOT NULL,
    project_id integer NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    description text,
    file_url text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    category text DEFAULT 'entrada'::text NOT NULL,
    required boolean DEFAULT false NOT NULL,
    object_path text,
    uploaded_at timestamp without time zone,
    display_category text
);


ALTER TABLE public.documents OWNER TO neondb_owner;

--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.documents_id_seq OWNER TO neondb_owner;

--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: homologacao_processos; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.homologacao_processos (
    id integer NOT NULL,
    project_id integer NOT NULL,
    kanban_stage text DEFAULT 'projeto_eletrico'::text NOT NULL,
    uc_numero text,
    numero_solicitacao text,
    links_enel text,
    email_acompanhamento text,
    datas_previstas jsonb DEFAULT '{}'::jsonb,
    art_paga boolean DEFAULT false NOT NULL,
    art_nf_url text,
    art_nf_object_path text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.homologacao_processos OWNER TO neondb_owner;

--
-- Name: homologacao_processos_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.homologacao_processos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.homologacao_processos_id_seq OWNER TO neondb_owner;

--
-- Name: homologacao_processos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.homologacao_processos_id_seq OWNED BY public.homologacao_processos.id;


--
-- Name: homologacao_sessions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.homologacao_sessions (
    id integer NOT NULL,
    technician_id integer NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.homologacao_sessions OWNER TO neondb_owner;

--
-- Name: homologacao_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.homologacao_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.homologacao_sessions_id_seq OWNER TO neondb_owner;

--
-- Name: homologacao_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.homologacao_sessions_id_seq OWNED BY public.homologacao_sessions.id;


--
-- Name: homologacao_technicians; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.homologacao_technicians (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.homologacao_technicians OWNER TO neondb_owner;

--
-- Name: homologacao_technicians_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.homologacao_technicians_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.homologacao_technicians_id_seq OWNER TO neondb_owner;

--
-- Name: homologacao_technicians_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.homologacao_technicians_id_seq OWNED BY public.homologacao_technicians.id;


--
-- Name: installer_accounts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.installer_accounts (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    team_name text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    razao_social text,
    cnpj text,
    responsavel_nome text,
    responsavel_telefone text,
    pix_key text,
    forma_pagamento text
);


ALTER TABLE public.installer_accounts OWNER TO neondb_owner;

--
-- Name: installer_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.installer_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.installer_accounts_id_seq OWNER TO neondb_owner;

--
-- Name: installer_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.installer_accounts_id_seq OWNED BY public.installer_accounts.id;


--
-- Name: installer_sessions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.installer_sessions (
    id integer NOT NULL,
    account_id integer NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.installer_sessions OWNER TO neondb_owner;

--
-- Name: installer_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.installer_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.installer_sessions_id_seq OWNER TO neondb_owner;

--
-- Name: installer_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.installer_sessions_id_seq OWNED BY public.installer_sessions.id;


--
-- Name: installer_team_members; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.installer_team_members (
    id integer NOT NULL,
    account_id integer NOT NULL,
    name text NOT NULL,
    documento text,
    photo_url text,
    doc_url text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.installer_team_members OWNER TO neondb_owner;

--
-- Name: installer_team_members_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.installer_team_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.installer_team_members_id_seq OWNER TO neondb_owner;

--
-- Name: installer_team_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.installer_team_members_id_seq OWNED BY public.installer_team_members.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    project_id integer NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO neondb_owner;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO neondb_owner;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: otp_codes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.otp_codes (
    id integer NOT NULL,
    email text NOT NULL,
    code text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.otp_codes OWNER TO neondb_owner;

--
-- Name: otp_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.otp_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.otp_codes_id_seq OWNER TO neondb_owner;

--
-- Name: otp_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.otp_codes_id_seq OWNED BY public.otp_codes.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    project_id integer NOT NULL,
    installment_number integer NOT NULL,
    amount real NOT NULL,
    due_date text NOT NULL,
    paid_date text,
    status text DEFAULT 'pending'::text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payments OWNER TO neondb_owner;

--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payments_id_seq OWNER TO neondb_owner;

--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: project_checklist_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.project_checklist_items (
    id integer NOT NULL,
    project_id integer NOT NULL,
    stage text NOT NULL,
    checklist_slug text NOT NULL,
    label text NOT NULL,
    done boolean DEFAULT false NOT NULL,
    done_by text,
    done_at timestamp without time zone,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    kind text DEFAULT 'check'::text NOT NULL,
    metadata jsonb
);


ALTER TABLE public.project_checklist_items OWNER TO neondb_owner;

--
-- Name: project_checklist_items_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.project_checklist_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.project_checklist_items_id_seq OWNER TO neondb_owner;

--
-- Name: project_checklist_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.project_checklist_items_id_seq OWNED BY public.project_checklist_items.id;


--
-- Name: project_purchases; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.project_purchases (
    id integer NOT NULL,
    project_id integer NOT NULL,
    supplier_id integer NOT NULL,
    categoria text NOT NULL,
    descricao text NOT NULL,
    status text DEFAULT 'cotacao'::text NOT NULL,
    valor_cotacao real,
    valor real,
    data_compra text,
    numero_nfe text,
    forma_pagamento text,
    transportadora text,
    codigo_rastreio text,
    previsao_entrega text,
    data_recebimento text,
    recebido_por text,
    observacoes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.project_purchases OWNER TO neondb_owner;

--
-- Name: project_purchases_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.project_purchases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.project_purchases_id_seq OWNER TO neondb_owner;

--
-- Name: project_purchases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.project_purchases_id_seq OWNED BY public.project_purchases.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    client_name text NOT NULL,
    client_email text NOT NULL,
    system_power real NOT NULL,
    status_step integer DEFAULT 1 NOT NULL,
    tracking_code text,
    tracking_carrier text,
    city text NOT NULL,
    state text NOT NULL,
    completion_percent integer DEFAULT 0 NOT NULL,
    estimated_activation text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    jestor_id text,
    client_phone text,
    notes text,
    estimated_date text,
    status_projeto text,
    valor_projeto real,
    forma_de_pagamento text,
    observacoes_gerais text,
    data_inicio_prevista text,
    data_conclusao_prevista text,
    data_de_fechamento text,
    data_de_pagamento text,
    data_de_compras text,
    data_de_entrega_do_equipamento text,
    scheduling_link text,
    section_visibility jsonb DEFAULT '{"chat": true, "payments": true, "tracking": true, "scheduling": true}'::jsonb,
    stage text DEFAULT 'onboarding'::text NOT NULL,
    capex real,
    receita_bruta real,
    homologacao_technician_id integer,
    homologacao_valor real,
    homologacao_pago boolean DEFAULT false NOT NULL,
    homologacao_forma_pagamento text,
    homologacao_pix text,
    custo_materiais real,
    custo_servico real,
    payment_plan_type text,
    sub_stage text
);


ALTER TABLE public.projects OWNER TO neondb_owner;

--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.projects_id_seq OWNER TO neondb_owner;

--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: scheduling_requests; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.scheduling_requests (
    id integer NOT NULL,
    project_id integer NOT NULL,
    requested_date text NOT NULL,
    notes text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.scheduling_requests OWNER TO neondb_owner;

--
-- Name: scheduling_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.scheduling_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.scheduling_requests_id_seq OWNER TO neondb_owner;

--
-- Name: scheduling_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.scheduling_requests_id_seq OWNED BY public.scheduling_requests.id;


--
-- Name: service_files; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.service_files (
    id integer NOT NULL,
    service_id integer NOT NULL,
    kind text DEFAULT 'imagens_documentacao'::text NOT NULL,
    name text,
    url text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.service_files OWNER TO neondb_owner;

--
-- Name: service_files_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.service_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.service_files_id_seq OWNER TO neondb_owner;

--
-- Name: service_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.service_files_id_seq OWNED BY public.service_files.id;


--
-- Name: service_team_members; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.service_team_members (
    id integer NOT NULL,
    service_id integer NOT NULL,
    member_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.service_team_members OWNER TO neondb_owner;

--
-- Name: service_team_members_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.service_team_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.service_team_members_id_seq OWNER TO neondb_owner;

--
-- Name: service_team_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.service_team_members_id_seq OWNED BY public.service_team_members.id;


--
-- Name: services; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.services (
    id integer NOT NULL,
    project_id integer,
    name text NOT NULL,
    tipo_servico text,
    valor_servico real,
    status text DEFAULT 'Agendado'::text NOT NULL,
    status_pagamento text DEFAULT 'Pendente'::text NOT NULL,
    pagamento_realizado boolean DEFAULT false NOT NULL,
    data_execucao timestamp without time zone,
    data_inicio timestamp without time zone,
    data_termino timestamp without time zone,
    equipe_execucao text,
    endereco text,
    responsavel_email text,
    observacoes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    valor_proposto real,
    valor_fechado real,
    custo_logistica real,
    outros_custos real,
    forma_pagamento text,
    pix_conta text,
    comprovante_url text,
    contrato_url text,
    contrato_status text DEFAULT 'pendente'::text NOT NULL,
    contrato_aceito_em timestamp without time zone,
    contrato_aceito_por text,
    escalacao_status text,
    escalacao_enviada_por text,
    escalacao_enviada_em timestamp without time zone,
    escalacao_decidida_por text,
    escalacao_decidida_em timestamp without time zone
);


ALTER TABLE public.services OWNER TO neondb_owner;

--
-- Name: services_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.services_id_seq OWNER TO neondb_owner;

--
-- Name: services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.services_id_seq OWNED BY public.services.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    project_id integer NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sessions OWNER TO neondb_owner;

--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sessions_id_seq OWNER TO neondb_owner;

--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.suppliers (
    id integer NOT NULL,
    name text NOT NULL,
    tipo text NOT NULL,
    contato_nome text,
    telefone text,
    email text,
    observacoes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.suppliers OWNER TO neondb_owner;

--
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.suppliers_id_seq OWNER TO neondb_owner;

--
-- Name: suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;


--
-- Name: replit_database_migrations_v1 id; Type: DEFAULT; Schema: _system; Owner: neondb_owner
--

ALTER TABLE ONLY _system.replit_database_migrations_v1 ALTER COLUMN id SET DEFAULT nextval('_system.replit_database_migrations_v1_id_seq'::regclass);


--
-- Name: admin_sessions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.admin_sessions ALTER COLUMN id SET DEFAULT nextval('public.admin_sessions_id_seq'::regclass);


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: homologacao_processos id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.homologacao_processos ALTER COLUMN id SET DEFAULT nextval('public.homologacao_processos_id_seq'::regclass);


--
-- Name: homologacao_sessions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.homologacao_sessions ALTER COLUMN id SET DEFAULT nextval('public.homologacao_sessions_id_seq'::regclass);


--
-- Name: homologacao_technicians id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.homologacao_technicians ALTER COLUMN id SET DEFAULT nextval('public.homologacao_technicians_id_seq'::regclass);


--
-- Name: installer_accounts id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.installer_accounts ALTER COLUMN id SET DEFAULT nextval('public.installer_accounts_id_seq'::regclass);


--
-- Name: installer_sessions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.installer_sessions ALTER COLUMN id SET DEFAULT nextval('public.installer_sessions_id_seq'::regclass);


--
-- Name: installer_team_members id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.installer_team_members ALTER COLUMN id SET DEFAULT nextval('public.installer_team_members_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: otp_codes id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.otp_codes ALTER COLUMN id SET DEFAULT nextval('public.otp_codes_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: project_checklist_items id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.project_checklist_items ALTER COLUMN id SET DEFAULT nextval('public.project_checklist_items_id_seq'::regclass);


--
-- Name: project_purchases id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.project_purchases ALTER COLUMN id SET DEFAULT nextval('public.project_purchases_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: scheduling_requests id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.scheduling_requests ALTER COLUMN id SET DEFAULT nextval('public.scheduling_requests_id_seq'::regclass);


--
-- Name: service_files id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.service_files ALTER COLUMN id SET DEFAULT nextval('public.service_files_id_seq'::regclass);


--
-- Name: service_team_members id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.service_team_members ALTER COLUMN id SET DEFAULT nextval('public.service_team_members_id_seq'::regclass);


--
-- Name: services id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.services ALTER COLUMN id SET DEFAULT nextval('public.services_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- Data for Name: replit_database_migrations_v1; Type: TABLE DATA; Schema: _system; Owner: neondb_owner
--

COPY _system.replit_database_migrations_v1 (id, build_id, deployment_id, statement_count, applied_at) FROM stdin;
1	f24033af-6dd1-4904-b899-49cdce1637c9	375543a8-204c-452a-b7c5-50ace997599b	15	2026-04-04 01:41:14.550004+00
2	07aff37a-b141-4f7c-85a9-4c0468117179	375543a8-204c-452a-b7c5-50ace997599b	4	2026-04-06 00:38:59.846382+00
3	40c67598-b2dc-4d2f-898a-62bfd51c39b2	375543a8-204c-452a-b7c5-50ace997599b	1	2026-04-06 00:50:56.236523+00
4	9b1a70cf-d4dd-4332-beb7-c4aba746013b	375543a8-204c-452a-b7c5-50ace997599b	40	2026-08-08 18:14:24.036821+00
\.


--
-- Data for Name: admin_sessions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.admin_sessions (id, token_hash, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.documents (id, project_id, name, type, description, file_url, created_at, category, required, object_path, uploaded_at, display_category) FROM stdin;
\.


--
-- Data for Name: homologacao_processos; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.homologacao_processos (id, project_id, kanban_stage, uc_numero, numero_solicitacao, links_enel, email_acompanhamento, datas_previstas, art_paga, art_nf_url, art_nf_object_path, updated_at, created_at) FROM stdin;
\.


--
-- Data for Name: homologacao_sessions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.homologacao_sessions (id, technician_id, token_hash, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: homologacao_technicians; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.homologacao_technicians (id, name, email, password_hash, created_at) FROM stdin;
\.


--
-- Data for Name: installer_accounts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.installer_accounts (id, name, email, team_name, password_hash, created_at, razao_social, cnpj, responsavel_nome, responsavel_telefone, pix_key, forma_pagamento) FROM stdin;
\.


--
-- Data for Name: installer_sessions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.installer_sessions (id, account_id, token_hash, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: installer_team_members; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.installer_team_members (id, account_id, name, documento, photo_url, doc_url, created_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.notifications (id, project_id, title, message, read, created_at) FROM stdin;
\.


--
-- Data for Name: otp_codes; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.otp_codes (id, email, code, expires_at, used, created_at) FROM stdin;
1	mateussmaia95@gmail.com	959797	2026-04-06 00:49:22.332	f	2026-04-06 00:39:22.702971
2	mateussmaia95@gmail.com	128437	2026-04-06 00:51:25.668	t	2026-04-06 00:41:25.956354
3	mateus@soloenergia.com.br	951089	2026-04-06 01:01:28.234	f	2026-04-06 00:51:28.59188
4	mateus@soloenergia.com.br	748982	2026-04-06 01:02:21.324	t	2026-04-06 00:52:21.597009
5	mateus@soloenergia.com.br	592055	2026-04-06 01:03:06.259	f	2026-04-06 00:53:06.276521
6	mateus@soloenergia.com.br	619168	2026-04-06 01:11:37.251	f	2026-04-06 01:01:38.114071
7	mateus@soloenergia.com.br	996837	2026-04-06 01:12:35.965	f	2026-04-06 01:02:36.2827
8	mateus@soloenergia.com.br	757276	2026-04-06 01:13:42.306	t	2026-04-06 01:03:42.607539
9	mateus@soloenergia.com.br	188526	2026-04-06 01:19:58.038	f	2026-04-06 01:09:58.489589
10	mateus@soloenergia.com.br	940690	2026-04-11 17:44:39.126	t	2026-04-11 17:34:40.015431
11	mateus@soloenergia.com.br	237523	2026-05-05 14:08:21.395	t	2026-05-05 13:58:24.289123
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.payments (id, project_id, installment_number, amount, due_date, paid_date, status, description, created_at) FROM stdin;
\.


--
-- Data for Name: project_checklist_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.project_checklist_items (id, project_id, stage, checklist_slug, label, done, done_by, done_at, sort_order, created_at, kind, metadata) FROM stdin;
\.


--
-- Data for Name: project_purchases; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.project_purchases (id, project_id, supplier_id, categoria, descricao, status, valor_cotacao, valor, data_compra, numero_nfe, forma_pagamento, transportadora, codigo_rastreio, previsao_entrega, data_recebimento, recebido_por, observacoes, created_at) FROM stdin;
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.projects (id, client_name, client_email, system_power, status_step, tracking_code, tracking_carrier, city, state, completion_percent, estimated_activation, created_at, jestor_id, client_phone, notes, estimated_date, status_projeto, valor_projeto, forma_de_pagamento, observacoes_gerais, data_inicio_prevista, data_conclusao_prevista, data_de_fechamento, data_de_pagamento, data_de_compras, data_de_entrega_do_equipamento, scheduling_link, section_visibility, stage, capex, receita_bruta, homologacao_technician_id, homologacao_valor, homologacao_pago, homologacao_forma_pagamento, homologacao_pix, custo_materiais, custo_servico, payment_plan_type, sub_stage) FROM stdin;
\.


--
-- Data for Name: scheduling_requests; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.scheduling_requests (id, project_id, requested_date, notes, status, created_at) FROM stdin;
\.


--
-- Data for Name: service_files; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.service_files (id, service_id, kind, name, url, created_at) FROM stdin;
\.


--
-- Data for Name: service_team_members; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.service_team_members (id, service_id, member_id, created_at) FROM stdin;
\.


--
-- Data for Name: services; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.services (id, project_id, name, tipo_servico, valor_servico, status, status_pagamento, pagamento_realizado, data_execucao, data_inicio, data_termino, equipe_execucao, endereco, responsavel_email, observacoes, created_at, updated_at, valor_proposto, valor_fechado, custo_logistica, outros_custos, forma_pagamento, pix_conta, comprovante_url, contrato_url, contrato_status, contrato_aceito_em, contrato_aceito_por, escalacao_status, escalacao_enviada_por, escalacao_enviada_em, escalacao_decidida_por, escalacao_decidida_em) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.sessions (id, project_id, token_hash, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.suppliers (id, name, tipo, contato_nome, telefone, email, observacoes, created_at) FROM stdin;
\.


--
-- Name: replit_database_migrations_v1_id_seq; Type: SEQUENCE SET; Schema: _system; Owner: neondb_owner
--

SELECT pg_catalog.setval('_system.replit_database_migrations_v1_id_seq', 4, true);


--
-- Name: admin_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.admin_sessions_id_seq', 1, false);


--
-- Name: documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.documents_id_seq', 1, false);


--
-- Name: homologacao_processos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.homologacao_processos_id_seq', 1, false);


--
-- Name: homologacao_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.homologacao_sessions_id_seq', 1, false);


--
-- Name: homologacao_technicians_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.homologacao_technicians_id_seq', 1, false);


--
-- Name: installer_accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.installer_accounts_id_seq', 1, false);


--
-- Name: installer_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.installer_sessions_id_seq', 1, false);


--
-- Name: installer_team_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.installer_team_members_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- Name: otp_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.otp_codes_id_seq', 11, true);


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.payments_id_seq', 1, false);


--
-- Name: project_checklist_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.project_checklist_items_id_seq', 1, false);


--
-- Name: project_purchases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.project_purchases_id_seq', 1, false);


--
-- Name: projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.projects_id_seq', 1, false);


--
-- Name: scheduling_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.scheduling_requests_id_seq', 1, false);


--
-- Name: service_files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.service_files_id_seq', 1, false);


--
-- Name: service_team_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.service_team_members_id_seq', 1, false);


--
-- Name: services_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.services_id_seq', 1, false);


--
-- Name: sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.sessions_id_seq', 1, false);


--
-- Name: suppliers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.suppliers_id_seq', 1, false);


--
-- Name: replit_database_migrations_v1 replit_database_migrations_v1_pkey; Type: CONSTRAINT; Schema: _system; Owner: neondb_owner
--

ALTER TABLE ONLY _system.replit_database_migrations_v1
    ADD CONSTRAINT replit_database_migrations_v1_pkey PRIMARY KEY (id);


--
-- Name: admin_sessions admin_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.admin_sessions
    ADD CONSTRAINT admin_sessions_pkey PRIMARY KEY (id);


--
-- Name: admin_sessions admin_sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.admin_sessions
    ADD CONSTRAINT admin_sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: homologacao_processos homologacao_processos_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.homologacao_processos
    ADD CONSTRAINT homologacao_processos_pkey PRIMARY KEY (id);


--
-- Name: homologacao_processos homologacao_processos_project_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.homologacao_processos
    ADD CONSTRAINT homologacao_processos_project_id_key UNIQUE (project_id);


--
-- Name: homologacao_sessions homologacao_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.homologacao_sessions
    ADD CONSTRAINT homologacao_sessions_pkey PRIMARY KEY (id);


--
-- Name: homologacao_sessions homologacao_sessions_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.homologacao_sessions
    ADD CONSTRAINT homologacao_sessions_token_hash_unique UNIQUE (token_hash);


--
-- Name: homologacao_technicians homologacao_technicians_email_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.homologacao_technicians
    ADD CONSTRAINT homologacao_technicians_email_unique UNIQUE (email);


--
-- Name: homologacao_technicians homologacao_technicians_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.homologacao_technicians
    ADD CONSTRAINT homologacao_technicians_pkey PRIMARY KEY (id);


--
-- Name: installer_accounts installer_accounts_email_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.installer_accounts
    ADD CONSTRAINT installer_accounts_email_key UNIQUE (email);


--
-- Name: installer_accounts installer_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.installer_accounts
    ADD CONSTRAINT installer_accounts_pkey PRIMARY KEY (id);


--
-- Name: installer_sessions installer_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.installer_sessions
    ADD CONSTRAINT installer_sessions_pkey PRIMARY KEY (id);


--
-- Name: installer_sessions installer_sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.installer_sessions
    ADD CONSTRAINT installer_sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: installer_team_members installer_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.installer_team_members
    ADD CONSTRAINT installer_team_members_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: otp_codes otp_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.otp_codes
    ADD CONSTRAINT otp_codes_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: project_checklist_items project_checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.project_checklist_items
    ADD CONSTRAINT project_checklist_items_pkey PRIMARY KEY (id);


--
-- Name: project_purchases project_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.project_purchases
    ADD CONSTRAINT project_purchases_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: scheduling_requests scheduling_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.scheduling_requests
    ADD CONSTRAINT scheduling_requests_pkey PRIMARY KEY (id);


--
-- Name: service_files service_files_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.service_files
    ADD CONSTRAINT service_files_pkey PRIMARY KEY (id);


--
-- Name: service_team_members service_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.service_team_members
    ADD CONSTRAINT service_team_members_pkey PRIMARY KEY (id);


--
-- Name: service_team_members service_team_members_service_id_member_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.service_team_members
    ADD CONSTRAINT service_team_members_service_id_member_id_key UNIQUE (service_id, member_id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: idx_replit_database_migrations_v1_build_id; Type: INDEX; Schema: _system; Owner: neondb_owner
--

CREATE UNIQUE INDEX idx_replit_database_migrations_v1_build_id ON _system.replit_database_migrations_v1 USING btree (build_id);


--
-- Name: IDX_purchases_project; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "IDX_purchases_project" ON public.project_purchases USING btree (project_id);


--
-- Name: documents_object_path_unique; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX documents_object_path_unique ON public.documents USING btree (object_path) WHERE (object_path IS NOT NULL);


--
-- Name: idx_checklist_project; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_checklist_project ON public.project_checklist_items USING btree (project_id);


--
-- Name: idx_homologacao_sessions_technician; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_homologacao_sessions_technician ON public.homologacao_sessions USING btree (technician_id);


--
-- Name: installer_team_members_account_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX installer_team_members_account_idx ON public.installer_team_members USING btree (account_id);


--
-- Name: projects_jestor_id_unique; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX projects_jestor_id_unique ON public.projects USING btree (jestor_id) WHERE (jestor_id IS NOT NULL);


--
-- Name: homologacao_sessions homologacao_sessions_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.homologacao_sessions
    ADD CONSTRAINT homologacao_sessions_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.homologacao_technicians(id) ON DELETE CASCADE;


--
-- Name: installer_team_members installer_team_members_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.installer_team_members
    ADD CONSTRAINT installer_team_members_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.installer_accounts(id) ON DELETE CASCADE;


--
-- Name: service_team_members service_team_members_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.service_team_members
    ADD CONSTRAINT service_team_members_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.installer_team_members(id) ON DELETE CASCADE;


--
-- Name: service_team_members service_team_members_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.service_team_members
    ADD CONSTRAINT service_team_members_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

\unrestrict 1M3rfp7jHQcd3Co0uHmpXyLChC91D8S6bimVz5aJgbYroef0o3o72UEEb9ZXfgR

