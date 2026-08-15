--
-- PostgreSQL database dump
--

\restrict Cd7adXeepUIpy1Fy8Ke3o6JuKWgwxNghXmDJ0E282j3745E7Udwgn8obqCG2h80

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4 (Homebrew)

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: DraftPick; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DraftPick" (
    id integer NOT NULL,
    year integer NOT NULL,
    round integer NOT NULL,
    "teamId" integer NOT NULL,
    "ownerLogoId" integer NOT NULL
);


ALTER TABLE public."DraftPick" OWNER TO postgres;

--
-- Name: DraftPick_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."DraftPick_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."DraftPick_id_seq" OWNER TO postgres;

--
-- Name: DraftPick_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."DraftPick_id_seq" OWNED BY public."DraftPick".id;


--
-- Name: GoalieRating; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."GoalieRating" (
    id integer NOT NULL,
    "playerId" integer NOT NULL,
    condition double precision,
    sk integer,
    du integer,
    en integer,
    sz integer,
    ag integer,
    rb integer,
    sc integer,
    hs integer,
    rt integer,
    ph integer,
    ps integer,
    ex integer,
    ld integer,
    mo integer,
    overall integer
);


ALTER TABLE public."GoalieRating" OWNER TO postgres;

--
-- Name: GoalieRating_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."GoalieRating_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."GoalieRating_id_seq" OWNER TO postgres;

--
-- Name: GoalieRating_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."GoalieRating_id_seq" OWNED BY public."GoalieRating".id;


--
-- Name: Player; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Player" (
    id integer NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    "position" text NOT NULL,
    positions text,
    "nhlId" integer,
    number integer,
    "photoUrl" text,
    "frozenPoolId" integer,
    "frozenPoolUrl" text,
    "frozenPoolPlayerSlug" text,
    "birthDate" text,
    "birthPlace" text,
    nationality text,
    shoots text,
    height text,
    weight integer,
    "capWagesSlug" text,
    "capHit" double precision,
    "contractYears" integer,
    "contractExpiry" integer,
    age integer,
    overall integer,
    "contractText" text,
    "rosterType" text,
    "teamId" integer NOT NULL,
    ck integer,
    condition double precision,
    df integer,
    di integer,
    du integer,
    en integer,
    ex integer,
    fg integer,
    fo integer,
    ld integer,
    mo integer,
    pa integer,
    ph integer,
    ps integer,
    sc integer,
    sk integer,
    st integer,
    "isGoalie" boolean DEFAULT false NOT NULL,
    "sourceType" text,
    "onTradeBlock" boolean DEFAULT false NOT NULL,
    "waiverStatus" text DEFAULT 'NONE'::text
);


ALTER TABLE public."Player" OWNER TO postgres;

--
-- Name: Player_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Player_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Player_id_seq" OWNER TO postgres;

--
-- Name: Player_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Player_id_seq" OWNED BY public."Player".id;


--
-- Name: Prospect; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Prospect" (
    id integer NOT NULL,
    name text NOT NULL,
    "draftYear" integer,
    "overallPick" integer,
    "teamId" integer NOT NULL
);


ALTER TABLE public."Prospect" OWNER TO postgres;

--
-- Name: Prospect_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Prospect_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Prospect_id_seq" OWNER TO postgres;

--
-- Name: Prospect_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Prospect_id_seq" OWNED BY public."Prospect".id;


--
-- Name: SkaterRating; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SkaterRating" (
    id integer NOT NULL,
    "playerId" integer NOT NULL,
    condition double precision,
    ck integer,
    fg integer,
    di integer,
    sk integer,
    st integer,
    en integer,
    du integer,
    ph integer,
    fo integer,
    pa integer,
    sc integer,
    df integer,
    ps integer,
    ex integer,
    ld integer,
    mo integer,
    overall integer
);


ALTER TABLE public."SkaterRating" OWNER TO postgres;

--
-- Name: SkaterRating_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."SkaterRating_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."SkaterRating_id_seq" OWNER TO postgres;

--
-- Name: SkaterRating_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."SkaterRating_id_seq" OWNED BY public."SkaterRating".id;


--
-- Name: Team; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Team" (
    id integer NOT NULL,
    slug text NOT NULL,
    code text,
    name text NOT NULL,
    "logoUrl" text,
    gm text NOT NULL,
    arena text NOT NULL,
    league text DEFAULT 'NHL'::text NOT NULL,
    "eliteProspectsUrl" text,
    "parentTeamId" integer,
    "profinhlName" text,
    "profinhlLogoId" integer,
    coach text,
    conference text,
    division text,
    capacity integer,
    "isAffiliate" boolean DEFAULT false NOT NULL,
    "profinhlId" integer
);


ALTER TABLE public."Team" OWNER TO postgres;

--
-- Name: Team_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Team_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Team_id_seq" OWNER TO postgres;

--
-- Name: Team_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Team_id_seq" OWNED BY public."Team".id;


--
-- Name: Trade; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Trade" (
    id integer NOT NULL,
    "fromTeamId" integer NOT NULL,
    "toTeamId" integer NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Trade" OWNER TO postgres;

--
-- Name: TradeAsset; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TradeAsset" (
    id integer NOT NULL,
    "tradeId" integer NOT NULL,
    "assetType" text NOT NULL,
    "playerId" integer,
    "prospectId" integer,
    "draftPickId" integer,
    "cashAmount" double precision,
    "retentionPct" double precision,
    side text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."TradeAsset" OWNER TO postgres;

--
-- Name: TradeAsset_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."TradeAsset_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."TradeAsset_id_seq" OWNER TO postgres;

--
-- Name: TradeAsset_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."TradeAsset_id_seq" OWNED BY public."TradeAsset".id;


--
-- Name: Trade_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Trade_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Trade_id_seq" OWNER TO postgres;

--
-- Name: Trade_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Trade_id_seq" OWNED BY public."Trade".id;


--
-- Name: Transaction; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Transaction" (
    id integer NOT NULL,
    type text NOT NULL,
    message text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Transaction" OWNER TO postgres;

--
-- Name: Transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Transaction_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Transaction_id_seq" OWNER TO postgres;

--
-- Name: Transaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Transaction_id_seq" OWNED BY public."Transaction".id;


--
-- Name: DraftPick id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DraftPick" ALTER COLUMN id SET DEFAULT nextval('public."DraftPick_id_seq"'::regclass);


--
-- Name: GoalieRating id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."GoalieRating" ALTER COLUMN id SET DEFAULT nextval('public."GoalieRating_id_seq"'::regclass);


--
-- Name: Player id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Player" ALTER COLUMN id SET DEFAULT nextval('public."Player_id_seq"'::regclass);


--
-- Name: Prospect id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Prospect" ALTER COLUMN id SET DEFAULT nextval('public."Prospect_id_seq"'::regclass);


--
-- Name: SkaterRating id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SkaterRating" ALTER COLUMN id SET DEFAULT nextval('public."SkaterRating_id_seq"'::regclass);


--
-- Name: Team id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Team" ALTER COLUMN id SET DEFAULT nextval('public."Team_id_seq"'::regclass);


--
-- Name: Trade id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Trade" ALTER COLUMN id SET DEFAULT nextval('public."Trade_id_seq"'::regclass);


--
-- Name: TradeAsset id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TradeAsset" ALTER COLUMN id SET DEFAULT nextval('public."TradeAsset_id_seq"'::regclass);


--
-- Name: Transaction id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Transaction" ALTER COLUMN id SET DEFAULT nextval('public."Transaction_id_seq"'::regclass);


--
-- Name: DraftPick DraftPick_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DraftPick"
    ADD CONSTRAINT "DraftPick_pkey" PRIMARY KEY (id);


--
-- Name: GoalieRating GoalieRating_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."GoalieRating"
    ADD CONSTRAINT "GoalieRating_pkey" PRIMARY KEY (id);


--
-- Name: Player Player_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Player"
    ADD CONSTRAINT "Player_pkey" PRIMARY KEY (id);


--
-- Name: Prospect Prospect_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Prospect"
    ADD CONSTRAINT "Prospect_pkey" PRIMARY KEY (id);


--
-- Name: SkaterRating SkaterRating_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SkaterRating"
    ADD CONSTRAINT "SkaterRating_pkey" PRIMARY KEY (id);


--
-- Name: Team Team_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_pkey" PRIMARY KEY (id);


--
-- Name: TradeAsset TradeAsset_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TradeAsset"
    ADD CONSTRAINT "TradeAsset_pkey" PRIMARY KEY (id);


--
-- Name: Trade Trade_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Trade"
    ADD CONSTRAINT "Trade_pkey" PRIMARY KEY (id);


--
-- Name: Transaction Transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_pkey" PRIMARY KEY (id);


--
-- Name: GoalieRating_playerId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "GoalieRating_playerId_key" ON public."GoalieRating" USING btree ("playerId");


--
-- Name: Player_nhlId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Player_nhlId_key" ON public."Player" USING btree ("nhlId");


--
-- Name: Player_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Player_slug_key" ON public."Player" USING btree (slug);


--
-- Name: SkaterRating_playerId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "SkaterRating_playerId_key" ON public."SkaterRating" USING btree ("playerId");


--
-- Name: Team_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Team_code_key" ON public."Team" USING btree (code);


--
-- Name: Team_profinhlId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Team_profinhlId_key" ON public."Team" USING btree ("profinhlId");


--
-- Name: Team_profinhlName_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Team_profinhlName_key" ON public."Team" USING btree ("profinhlName");


--
-- Name: Team_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Team_slug_key" ON public."Team" USING btree (slug);


--
-- Name: DraftPick DraftPick_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DraftPick"
    ADD CONSTRAINT "DraftPick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GoalieRating GoalieRating_playerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."GoalieRating"
    ADD CONSTRAINT "GoalieRating_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES public."Player"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Player Player_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Player"
    ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Prospect Prospect_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Prospect"
    ADD CONSTRAINT "Prospect_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SkaterRating SkaterRating_playerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SkaterRating"
    ADD CONSTRAINT "SkaterRating_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES public."Player"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Team Team_parentTeamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_parentTeamId_fkey" FOREIGN KEY ("parentTeamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict Cd7adXeepUIpy1Fy8Ke3o6JuKWgwxNghXmDJ0E282j3745E7Udwgn8obqCG2h80

