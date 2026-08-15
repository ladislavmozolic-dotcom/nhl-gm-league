--
-- PostgreSQL database dump
--

\restrict lzn4IEGe6TkjQIefMryyHjZmtBgo5vtOqQVrzMdXgwSmDXB5MA2dP3u8VeHHm05

-- Dumped from database version 18.4
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
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Player; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Player" (
    id integer NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    "position" text NOT NULL,
    "teamId" integer NOT NULL,
    "nhlId" integer,
    number integer,
    "capHit" double precision,
    "contractExpiry" integer,
    "contractYears" integer,
    "birthDate" text,
    "birthPlace" text,
    height text,
    "photoUrl" text,
    shoots text,
    weight integer,
    positions text,
    nationality text,
    "frozenPoolUrl" text,
    "frozenPoolId" integer,
    "frozenPoolPlayerSlug" text,
    "capWagesSlug" text
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
-- Name: Team; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Team" (
    id integer NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    gm text NOT NULL,
    arena text NOT NULL,
    code text,
    league text DEFAULT 'NHL'::text NOT NULL,
    "parentTeamId" integer,
    "eliteProspectsUrl" text,
    "logoUrl" text
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
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: Player id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Player" ALTER COLUMN id SET DEFAULT nextval('public."Player_id_seq"'::regclass);


--
-- Name: Team id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Team" ALTER COLUMN id SET DEFAULT nextval('public."Team_id_seq"'::regclass);


--
-- Data for Name: Player; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Player" (id, slug, name, "position", "teamId", "nhlId", number, "capHit", "contractExpiry", "contractYears", "birthDate", "birthPlace", height, "photoUrl", shoots, weight, positions, nationality, "frozenPoolUrl", "frozenPoolId", "frozenPoolPlayerSlug", "capWagesSlug") FROM stdin;
687	artturi-lehkonen	Artturi Lehkonen	L	329	8477476	62	4500000	2027	1	1995-07-04	Piikkio, FIN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/COL/8477476.png	L	179	LW/RW	FIN	\N	\N	\N	artturi-lehkonen
21	jake-walman	Jake Walman	D	1	8478013	96	7000000	2033	7	1996-02-20	Toronto, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8478013.png	L	218	D	CAN	\N	\N	\N	\N
110	luke-evangelista	Luke Evangelista	R	22	8482146	77	3000000	2027	1	2002-02-21	Toronto, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8482146.png	R	183	RW	CAN	\N	\N	\N	\N
407	nick-schmaltz	Nick Schmaltz	C	34	8477951	8	8000000	2034	8	1996-02-23	Madison, Wisconsin, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8477951.png	R	184	C/RW	USA	\N	\N	\N	\N
358	jeffrey-viel	Jeffrey Viel	L	32	8479705	25	2500000	2031	5	1997-01-28	Rimouski, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8479705.png	L	214	LW	CAN	\N	\N	\N	\N
324	jack-finley	Jack Finley	C	320	8482090	37	825000	2028	2	2002-09-02	St. Louis, Missouri, USA	6'6"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8482090.png	R	227	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8482	8482	\N	\N
664	nick-lardis	Nick Lardis	F	316	8484185	76	896667	2028	2	2005-07-08	Oakville, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8484185.png	L	165	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10138	10138	\N	\N
204	dylan-cozens	Dylan Cozens	C	26	8481528	24	7100000	2030	4	2001-02-09	Whitehorse, Yukon Territory, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8481528.png	R	205	C/RW	CAN	\N	\N	\N	\N
398	lawson-crouse	Lawson Crouse	L	329	8478474	67	4300000	2027	1	1997-06-23	Mt. Brydges, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8478474.png	L	214	LW/RW	CAN	\N	\N	\N	lawson-crouse
4831	trey-fix-wolansky	Trey Fix-wolansky	F	329	8480441	\N	900000	2027	1	1999-05-26	Edmonton, Alberta, CAN	5'6"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8480441.png	R	193	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7669	7669	\N	trey-fix-wolansky
566	connor-clifton	Connor Clifton	D	329	8477365	75	2250000	2028	2	1995-04-28	Matawan, New Jersey, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8477365.png	R	196	D	USA	\N	\N	\N	connor-clifton
546	jett-woo	Jett Woo	D	329	8480808	\N	875000	2028	2	2000-07-27	Winnipeg, Manitoba, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8480808.png	R	205	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7597	7597	\N	jett-woo
64	jonas-brodin	Jonas Brodin	D	329	8476463	25	6000000	2028	2	1993-07-12	Karlstad, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8476463.png	L	196	D	SWE	\N	\N	\N	jonas-brodin
304	kaapo-kakko	Kaapo Kakko	R	329	8481554	84	4525000	2028	2	2001-02-13	Turku, FIN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8481554.png	L	215	LW/RW	FIN	\N	\N	\N	kaapo-kakko
391	troy-stecher	Troy Stecher	D	329	8479442	28	1350000	2028	2	1994-04-07	Richmond, British Columbia, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8479442.png	R	184	D	CAN	\N	\N	\N	troy-stecher
315	adam-larsson	Adam Larsson	D	329	8476457	6	5250000	2029	3	1992-11-12	Skelleftea, SWE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8476457.png	R	207	D	SWE	\N	\N	\N	adam-larsson
645	eric-robinson	Eric Robinson	L	329	8480762	50	1700000	2029	3	1995-06-14	Bellmawr, New Jersey, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8480762.png	L	220	LW/RW	USA	\N	\N	\N	eric-robinson
285	mason-marchment	Mason Marchment	L	29	8478975	27	6750000	2031	5	1995-06-18	Uxbridge, Ontario, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8478975.png	L	212	LW	CAN	\N	\N	\N	\N
652	alexander-nikishin	Alexander Nikishin	D	11	8482100	21	925000	2026	0	2001-10-02	Orel, RUS	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8482100.png	L	218	D	RUS	\N	\N	\N	\N
150	david-rittich	David Rittich	G	329	8479496	\N	1000000	2027	1	1992-08-19	Jihlava, CZE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8479496.png	L	200	\N	CZE	\N	\N	\N	david-rittich
549	ville-husso	Ville Husso	G	329	8478024	33	2200000	2027	1	1995-02-06	Helsinki, FIN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8478024.png	L	205	\N	FIN	\N	\N	\N	ville-husso
203	nick-cousins	Nick Cousins	C	329	8476393	21	1587500	2028	2	1993-07-20	Belleville, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8476393.png	L	191	C/LW	CAN	\N	\N	\N	nick-cousins
166	adam-pelech	Adam Pelech	D	329	8476917	3	5750000	2029	3	1994-08-16	Toronto, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8476917.png	L	212	D	CAN	\N	\N	\N	adam-pelech
646	jordan-staal	Jordan Staal	C	329	8473533	11	2918750	2027	1	1988-09-10	Thunder Bay, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8473533.png	L	220	C/LW	CAN	\N	\N	\N	jordan-staal
279	arturs-silovs	Arturs Silovs	G	28	8481668	37	2800000	2027	1	2001-03-22	Riga, LVA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8481668.png	L	208	\N	LVA	\N	\N	\N	\N
4920	frederic-brunet	Frederic Brunet	D	314	8483017	\N	875000	2028	2	2003-08-21	Gatineau, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8483017.png	L	200	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9712	9712	\N	\N
488	jakob-chychrun	Jakob Chychrun	D	37	8479345	6	9000000	2033	7	1998-03-31	Boca Raton, Florida, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8479345.png	L	215	D	USA	\N	\N	\N	\N
4999	nolan-foote	Nolan Foote	L	299	8481518	\N	850000	2027	1	2000-11-29	Denver, Colorado, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8481518.png	L	196	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8405	8405	\N	\N
5134	damien-carfagna	Damien Carfagna	D	296	8485484	\N	900000	2027	1	2002-12-12	Wood-Ridge, New Jersey, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8485484.png	L	170	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10594	10594	\N	\N
5281	andrew-gibson	Andrew Gibson	D	312	8484174	\N	896667	2028	2	2005-02-13	Windsor, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8484174.png	R	211	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10185	10185	\N	\N
5338	miko-matikka	Miko Matikka	F	323	8483671	\N	895000	2027	1	2003-10-26	Helsinki, FIN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8483671.png	R	187	LW/RW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10211	10211	\N	\N
5425	juuso-parssinen	Juuso Parssinen	C	305	8481704	\N	1250000	2027	1	2001-02-01	Hameenlinna, FIN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8481704.png	L	207	C	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9164	9164	\N	\N
5490	will-zmolek	Will Zmolek	D	308	8484115	\N	920000	2024	0	1999-04-02	Rochester, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8484115.png	L	205	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9619	9619	\N	\N
5504	coulson-pitre	Coulson Pitre	R	317	8484216	\N	885000	2027	1	2004-12-13	Newmarket, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8484216.png	R	185	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10270	10270	\N	\N
5575	roman-schmidt	Roman Schmidt	D	308	8482693	\N	850000	2027	1	2003-02-27	Midland, Michigan, USA	6'5"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8482693.png	R	225	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9749	9749	\N	\N
5628	william-dufour	William Dufour	L	304	8482207	\N	859167	2025	0	2002-01-28	Quebec City, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DET/8482207.png	R	210	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9440	9440	\N	\N
4798	arthur-kaliyev	Arthur Kaliyev	L	329	8481560	\N	775000	2026	0	2001-06-26	Tashkent, UZB	6'2"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8481560.png	L	212	RW	UZB	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7677	7677	\N	arthur-kaliyev
5711	ben-dexheimer	Ben Dexheimer	D	308	8486182	\N	980000	2027	1	2002-06-21	USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8486182.png	\N	180	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11086	11086	\N	\N
5054	gavin-bayreuther	Gavin Bayreuther	D	329	8479945	\N	775000	2026	0	1994-05-12	Canaan, New Hampshire, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8479945.png	L	210	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6633	6633	\N	gavin-bayreuther
5196	hudson-fasching	Hudson Fasching	R	329	8477392	\N	775000	2026	0	1995-07-28	Apple Valley, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8477392.png	R	214	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6516	6516	\N	hudson-fasching
4961	samuel-fagemo	Samuel Fagemo	L	329	8481239	\N	775000	2026	0	2000-03-14	Göteborg, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8481239.png	R	200	LW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7680	7680	\N	samuel-fagemo
4861	andre-lee	Andre Lee	F	329	8481732	\N	812500	2027	1	2000-07-26	Karlstad, SWE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8481732.png	L	210	LW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9081	9081	\N	andre-lee
295	dmitry-orlov	Dmitry Orlov	D	329	8475200	9	6500000	2027	1	1991-07-23	Novokuznetsk, RUS	5'11"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8475200.png	L	215	D	RUS	\N	\N	\N	dmitry-orlov
5201	jimmy-schuldt	Jimmy Schuldt	D	329	8481486	\N	812500	2027	1	1995-05-11	Minnetonka, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8481486.png	L	203	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7767	7767	\N	jimmy-schuldt
5160	william-lagesson	William Lagesson	D	329	8478021	\N	812500	2027	1	1996-02-22	Gothenburg, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/DET/8478021.png	L	211	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7404	7404	\N	william-lagesson
608	joel-farabee	Joel Farabee	L	329	8480797	86	5000000	2028	2	2000-02-25	Syracuse, New York, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8480797.png	L	186	LW	USA	\N	\N	\N	joel-farabee
512	mario-ferraro	Mario Ferraro	D	329	8479983	38	4000000	2029	3	1998-09-17	Toronto, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8479983.png	L	200	D	CAN	\N	\N	\N	mario-ferraro
326	ross-johnston	Ross Johnston	L	329	8477527	\N	2000000	2029	3	1994-02-18	Charlottetown, Prince Edward Island, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/STL/8477527.png	L	232	LW	CAN	\N	\N	\N	ross-johnston
4914	andrew-agozzino	Andrew Agozzino	C	329	8475461	\N	775000	2026	0	1991-01-03	Kleinburg, Ontario, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8475461.png	L	187	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=3642	3642	\N	andrew-agozzino
387	jake-mccabe	Jake McCabe	D	2	8476931	22	4491898	2030	4	1993-10-12	Eau Claire, Wisconsin, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8476931.png	L	210	D	USA	\N	\N	\N	\N
442	kevin-lankinen	Kevin Lankinen	G	35	8480947	32	4500000	2030	4	1995-04-28	Helsinki, FIN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8480947.png	L	190	\N	FIN	\N	\N	\N	\N
111	aiden-fink	Aiden Fink	R	312	8484494	18	950000	2028	2	2004-11-24	Calgary, Alberta, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8484494.png	R	165	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11023	11023	\N	\N
5101	kevin-rooney	Kevin Rooney	C	329	8479291	\N	775000	2026	0	1993-05-21	Canton, Massachusetts, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8479291.png	L	190	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6263	6263	\N	kevin-rooney
431	aatu-rty	Aatu Räty	C	35	8482691	54	\N	\N	\N	2002-11-14	Oulu, FIN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8482691.png	L	204	C/LW	FIN	\N	\N	\N	\N
515	neal-pionk	Neal Pionk	D	38	8480145	4	7000000	2031	5	1995-07-29	Omaha, Nebraska, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8480145.png	R	190	D	USA	\N	\N	\N	\N
10203	chris-terry	Chris Terry	F	326	8474052	\N	675000	2020	0	1989-04-07	Brampton, Ontario, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8474052.png	L	191	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=2350	2350	\N	\N
98	mike-matheson	Mike Matheson	D	21	8476875	8	6000000	2031	5	1994-02-27	Pointe-Claire, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8476875.png	L	196	D	CAN	\N	\N	\N	\N
268	nicholas-robertson	Nicholas Robertson	L	28	8481582	\N	3250000	2028	2	2001-09-11	Pasadena, California, USA	5'9"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8481582.png	L	180	LW/RW	USA	\N	\N	\N	\N
405	ben-mccartney	Ben Mccartney	F	329	8481827	62	812500	2027	1	2001-07-13	Portage la Prairie, Manitoba, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8481827.png	L	182	LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8734	8734	\N	ben-mccartney
513	haydn-fleury	Haydn Fleury	D	329	8477938	24	950000	2027	1	1996-07-08	Carlyle, Saskatchewan, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8477938.png	L	207	D	CAN	\N	\N	\N	haydn-fleury
409	brandon-tanev	Brandon Tanev	L	329	8479293	13	2500000	2028	2	1991-12-31	Toronto, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8479293.png	L	189	LW/RW	CAN	\N	\N	\N	brandon-tanev
10131	daylan-kuefler	Daylan Kuefler	F	329	\N	\N	875000	2028	2	2002-02-10	\N	6'2	\N	L	196	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9442	9442	\N	daylan-kuefler
159	jean-gabriel-pageau	Jean-Gabriel Pageau	C	329	8476419	44	4850000	2029	3	1992-11-11	Ottawa, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8476419.png	R	180	C	CAN	\N	\N	\N	jean-gabriel-pageau
622	connor-zary	Connor Zary	C	10	8482074	47	3775000	2028	2	2001-09-25	Saskatoon, Saskatchewan, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8482074.png	L	178	C/LW/RW	CAN	\N	\N	\N	\N
694	fedor-svechkov	Fedor Svechkov	C	312	8482768	\N	1250000	2028	2	2003-04-05	Togliatti, RUS	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8482768.png	L	187	C/LW	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9877	9877	\N	\N
292	sam-dickinson	Sam Dickinson	D	29	8484806	6	975000	2028	2	2006-06-07	Toronto, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8484806.png	L	200	D	CAN	\N	\N	\N	\N
325	dylan-holloway	Dylan Holloway	L	31	8482077	81	7750000	2031	5	2001-09-23	Calgary, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/STL/8482077.png	L	207	LW/RW	CAN	\N	\N	\N	\N
13312	cameron-whitehead	CAMERON WHITEHEAD	G	306	8483523	\N	906250	2027	1	2003-06-13	Orleans, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8483523.png	L	192	\N	CAN	https://frozenpool.dobbersports.com/players/cameron-whitehead	\N	\N	\N
392	chris-tanev	Chris Tanev	D	2	8475690	8	4500000	2030	4	1989-12-20	Toronto, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8475690.png	R	200	D	CAN	\N	\N	\N	\N
390	morgan-rielly	Morgan Rielly	D	2	8476853	44	7500000	2030	4	1994-03-09	Vancouver, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8476853.png	L	219	D	CAN	\N	\N	\N	\N
583	beck-malenstyn	Beck Malenstyn	L	9	8479359	29	2916667	2032	6	1998-02-04	Delta, British Columbia, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8479359.png	L	209	LW/RW	CAN	\N	\N	\N	\N
720	denton-mateychuk	Denton Mateychuk	D	14	8483485	5	950000	2027	1	2004-07-12	Winnipeg, Manitoba, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8483485.png	L	188	D	CAN	\N	\N	\N	\N
4811	andrew-cristall	Andrew Cristall	L	307	8484159	\N	905000	2028	2	2005-02-04	Vancouver, British Columbia, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8484159.png	L	167	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10174	10174	\N	\N
804	sam-reinhart	Sam Reinhart	C	18	8477933	13	8625000	2032	6	1995-11-06	West Vancouver, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8477933.png	R	196	C/RW	CAN	\N	\N	\N	\N
306	bobby-mcmann	Bobby McMann	C	30	8482259	74	5750000	2032	6	1996-06-15	Wainwright, Alberta, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8482259.png	L	217	C	CAN	\N	\N	\N	\N
139	dawson-mercer	Dawson Mercer	C	23	8482110	91	4000000	2027	1	2001-10-27	Carbonear, Newfoundland and Labrador, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8482110.png	R	180	C/RW	CAN	\N	\N	\N	\N
242	trevor-zegras	Trevor Zegras	C	27	8481533	46	9125000	2030	4	2001-03-20	Bedford, New York, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8481533.png	L	185	C/LW	USA	\N	\N	\N	\N
4829	sasha-pastujov	Sasha Pastujov	R	317	8482682	\N	870000	2026	0	2003-07-15	Bradenton, Florida, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8482682.png	L	186	LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9189	9189	\N	\N
397	logan-cooley	Logan Cooley	C	34	8483431	92	10000000	2034	8	2004-05-04	Pittsburgh, Pennsylvania, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8483431.png	L	191	C/LW	USA	\N	\N	\N	\N
590	jason-zucker	Jason Zucker	L	329	8475722	17	4750000	2027	1	1992-01-16	Newport Beach, California, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8475722.png	L	198	LW/RW	USA	\N	\N	\N	jason-zucker
10078	alex-jefferies	Alex Jefferies	F	326	8482154	\N	867500	2026	0	2001-11-08	Framingham, Massachusetts, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8482154.png	R	192	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10040	10040	\N	\N
710	kirill-marchenko	Kirill Marchenko	R	14	8480893	86	3850000	2027	1	2000-07-21	Barnaul, RUS	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8480893.png	R	201	LW/RW	RUS	\N	\N	\N	\N
749	mason-appleton	Mason Appleton	C	329	8478891	22	2900000	2027	1	1996-01-15	Green Bay, Wisconsin, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/DET/8478891.png	R	196	C/RW	USA	\N	\N	\N	mason-appleton
609	morgan-frost	Morgan Frost	C	329	8480028	16	4375000	2027	1	1999-05-14	Aurora, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8480028.png	L	193	C/LW	CAN	\N	\N	\N	morgan-frost
738	tyler-seguin	Tyler Seguin	C	329	8475794	91	9850000	2027	1	1992-01-31	Brampton, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8475794.png	R	205	C/RW	CAN	\N	\N	\N	tyler-seguin
453	william-karlsson	William Karlsson	C	329	8476448	71	5900000	2027	1	1993-01-08	Marsta, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8476448.png	L	190	C	SWE	\N	\N	\N	william-karlsson
153	anthony-duclair	Anthony Duclair	L	329	8477407	11	3500000	2028	2	1995-08-26	Pointe-Claire, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8477407.png	L	198	LW/RW	CAN	\N	\N	\N	anthony-duclair
379	auston-matthews	Auston Matthews	C	329	8479318	34	13250000	2028	2	1997-09-17	San Ramon, California, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8479318.png	L	215	C/LW	USA	\N	\N	\N	auston-matthews
187	sean-durzi	Sean Durzi	D	329	8480434	5	6000000	2028	2	1998-10-21	Mississauga, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8480434.png	R	196	D	CAN	\N	\N	\N	sean-durzi
648	andrei-svechnikov	Andrei Svechnikov	R	329	8480830	37	7750000	2029	3	2000-03-26	Barnaul, RUS	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8480830.png	L	200	LW/RW	RUS	\N	\N	\N	andrei-svechnikov
603	ukko-pekka-luukkonen	Ukko-Pekka Luukkonen	G	329	8480045	1	4750000	2029	3	1999-03-09	Espoo, FIN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8480045.png	L	223	\N	FIN	\N	\N	\N	ukko-pekka-luukkonen
4993	garrett-pilon	Garrett Pilon	C	329	8479516	\N	775000	2026	0	1998-04-13	Mineola, New York, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8479516.png	R	209	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6715	6715	\N	garrett-pilon
5149	jorian-donovan	Jorian Donovan	D	297	8483435	\N	831667	2027	1	2004-04-05	Calgary, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8483435.png	L	200	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9719	9719	\N	\N
68	daemon-hunt	Daemon Hunt	D	20	8482094	48	900000	2027	1	2002-05-15	Brandon, Manitoba, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8482094.png	L	193	D	CAN	\N	\N	\N	\N
88	alex-newhook	Alex Newhook	C	21	8481618	15	2900000	2027	1	2001-01-28	St. John's, Newfoundland and Labrador, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8481618.png	L	200	C/LW/RW	CAN	\N	\N	\N	\N
665	andrew-mangiapane	Andrew Mangiapane	R	329	8478233	26	3600000	2027	1	1996-04-04	Toronto, Ontario, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8478233.png	L	183	LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6476	6476	\N	andrew-mangiapane
236	carl-grundstrom	Carl Grundstrom	F	329	8479336	91	1000000	2027	1	1997-12-01	Umea, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8479336.png	L	200	RW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6788	6788	\N	carl-grundstrom
32	scott-laughton	Scott Laughton	C	329	8476872	21	3500000	2029	3	1994-05-30	Oakville, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8476872.png	L	190	C/LW	CAN	\N	\N	\N	scott-laughton
74	filip-gustavsson	Filip Gustavsson	G	20	8479406	32	6800000	2031	5	1998-06-07	Skelleftea, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8479406.png	L	184	\N	SWE	\N	\N	\N	\N
78	chase-wutzke	Chase Wutzke	G	20	8485037	95	962500	2029	3	2006-07-26	Debden, Saskatchewan, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8485037.png	L	158	\N	CAN	\N	\N	\N	\N
280	macklin-celebrini	Macklin Celebrini	C	29	8484801	71	975000	2027	1	2006-06-13	North Vancouver, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8484801.png	L	190	C/LW	CAN	\N	\N	\N	\N
440	tom-willander	Tom Willander	D	295	8484240	5	950000	2028	2	2005-02-09	Stockholm, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8484240.png	R	180	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10751	10751	\N	\N
530	nico-myatovic	Nico Myatovic	L	317	8484201	48	896667	2027	1	2004-12-01	Prince George, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8484201.png	L	203	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10076	10076	\N	\N
754	emmitt-finnie	Emmitt Finnie	C	16	8484471	58	845000	2028	2	2005-06-27	Lethbridge, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/DET/8484471.png	L	195	C/LW/RW	CAN	\N	\N	\N	\N
647	logan-stankoven	Logan Stankoven	C	11	8482702	22	6000000	2034	8	2003-02-26	Kamloops, British Columbia, CAN	5'8"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8482702.png	R	165	C/RW	CAN	\N	\N	\N	\N
672	bowen-byram	Bowen Byram	D	12	8481524	\N	12500000	2033	7	2001-06-13	Cranbrook, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8481524.png	L	205	D	CAN	\N	\N	\N	\N
5215	jamieson-rees	Jamieson Rees	L	297	8481579	\N	775000	2025	0	2001-02-26	Hamilton, Ontario, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8481579.png	L	186	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8442	8442	\N	\N
4824	xavier-bourgault	Xavier Bourgault	R	297	8482673	\N	850000	2027	1	2002-10-22	L'Islet, Quebec, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8482673.png	R	185	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9448	9448	\N	\N
4996	jakub-brabenec	Jakub Brabenec	F	306	8482724	\N	846667	2026	0	2003-09-11	Jihlava, CZE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8482724.png	L	190	C/LW	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9266	9266	\N	\N
5279	alex-gagne	Alex Gagne	D	303	8482942	\N	910000	2027	1	2002-08-12	Bedford, New Hampshire, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/COL/8482942.png	L	205	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10654	10654	\N	\N
5385	vilmer-alriksson	Vilmer Alriksson	L	295	8484408	\N	860000	2028	2	2005-02-18	Stockholm, SWE	6'6"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8484408.png	L	214	LW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10117	10117	\N	\N
5302	chase-bradley	Chase Bradley	F	303	8482507	\N	875000	2028	2	2002-01-09	St. Louis, Missouri, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/COL/8482507.png	L	180	C/LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10249	10249	\N	\N
5463	ty-murchison	Ty Murchison	D	310	8482804	\N	897500	2027	1	2003-02-02	Corona, California, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8482804.png	L	212	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10552	10552	\N	\N
5617	riley-patterson	Riley Patterson	C	295	\N	\N	923333	2029	3	2006-03-22	\N	6'0	\N	R	192	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11053	11053	\N	\N
5606	luke-kunin	Luke Kunin	C	329	8479316	\N	775000	2026	0	1997-12-04	Chesterfield, Missouri, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8479316.png	R	197	C/LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6659	6659	\N	luke-kunin
4988	wojciech-stachowiak	Wojciech Stachowiak	C	329	8485539	\N	775000	2026	0	1999-07-03	Gdansk, POL	6'1"	https://assets.nhle.com/mugs/nhl/20262027/DET/8485539.png	L	194	C	POL	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10835	10835	\N	wojciech-stachowiak
5225	ronnie-attard	Ronnie Attard	D	329	8481521	\N	850000	2027	1	1999-03-20	White Lake, Michigan, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/COL/8481521.png	R	208	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9571	9571	\N	ronnie-attard
4900	vinni-lettieri	Vinni Lettieri	C	329	8479968	\N	850000	2027	1	1995-02-06	Excelsior, Minnesota, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8479968.png	R	184	C/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6681	6681	\N	vinni-lettieri
816	alexander-petrovic	Alexander Petrovic	D	329	8475755	36	875000	2028	2	1992-03-03	Edmonton, Alberta, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8475755.png	R	215	D	CAN	\N	\N	\N	alexander-petrovic
4964	brian-halonen	Brian Halonen	F	329	8483531	\N	875000	2028	2	1999-01-11	Delano, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8483531.png	R	207	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9067	9067	\N	brian-halonen
5414	colton-white	Colton White	D	329	8478841	\N	875000	2028	2	1997-05-03	London, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8478841.png	L	187	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6362	6362	\N	colton-white
5271	luke-tuch	Luke Tuch	L	329	8482134	\N	875000	2028	2	2002-03-07	Syracuse, New York, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8482134.png	L	215	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10149	10149	\N	luke-tuch
606	mikael-backlund	Mikael Backlund	C	329	8474150	11	3250000	2028	2	1989-03-17	Vasteras, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8474150.png	L	206	C	SWE	\N	\N	\N	mikael-backlund
113	nils-hoglander	Nils Hoglander	L	329	8481535	\N	3000000	2028	2	2000-12-20	Bockträsk, SWE	5'9"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8481535.png	L	185	LW/RW	SWE	\N	\N	\N	nils-hoglander
4948	trevor-kuntar	Trevor Kuntar	L	329	8482479	\N	875000	2028	2	2001-06-20	Buffalo, New York, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8482479.png	L	205	C/LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9700	9700	\N	trevor-kuntar
5501	christoffer-sedoff	Christoffer Sedoff	D	329	8482138	\N	870000	2026	0	2002-02-20	Helsinki, FIN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8482138.png	L	209	D	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9951	9951	\N	christoffer-sedoff
108	jack-drury	Jack Drury	C	22	8480835	\N	4500000	2031	5	2000-02-03	New York, New York, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8480835.png	L	186	C	USA	\N	\N	\N	\N
4884	cole-o-hara	Cole O'hara	R	312	8483696	\N	897500	2027	1	2002-06-20	Richmond Hill, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8483696.png	R	189	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10609	10609	\N	\N
5769	matthew-andonovski	Matthew Andonovski	D	297	\N	\N	863333	2028	2	2005-03-14	\N	6'2	\N	L	215	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10885	10885	\N	\N
10259	isaiah-george	Isaiah George	D	326	8483448	\N	870000	2027	1	2004-02-15	Oakville, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8483448.png	L	203	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10389	10389	\N	\N
5691	saige-weinstein	Saige Weinstein	D	303	\N	\N	800000	2028	2	2005-05-30	\N	6'1	\N	L	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10129	10129	\N	\N
5158	thomas-bordeleau	Thomas Bordeleau	F	329	8482133	\N	775000	2026	0	2002-01-03	Houston, Texas, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/STL/8482133.png	L	180	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9114	9114	\N	thomas-bordeleau
5665	josh-dunne	Josh Dunne	C	329	8482623	\N	850000	2027	1	1998-12-08	O'Fallon, Missouri, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8482623.png	L	208	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8641	8641	\N	josh-dunne
103	jakub-dobes	Jakub Dobes	G	21	8482487	75	5357575	2030	4	2001-05-27	Ostrava, CZE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8482487.png	L	215	\N	CZE	\N	\N	\N	\N
10444	victor-eklund	Victor Eklund	F	326	\N	\N	975000	2029	3	2006-10-03	\N	5'11	\N	R	161	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11013	11013	\N	\N
10596	gleb-veremyev	Gleb Veremyev	F	326	8485462	\N	910000	2027	1	2003-06-28	Monroe Township, New Jersey, USA	6'5"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8485462.png	L	218	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10521	10521	\N	\N
17	ty-emberson	Ty Emberson	D	329	8480834	49	1300000	2027	1	2000-05-23	Eau Claire, Wisconsin, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8480834.png	R	193	D	USA	\N	\N	\N	ty-emberson
28	erik-haula	Erik Haula	L	329	8475287	\N	3600000	2028	2	1991-03-23	Pori, FIN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8475287.png	L	191	C/LW	FIN	\N	\N	\N	erik-haula
5140	joey-willis	Joey Willis	L	312	8484412	\N	910000	2028	2	2005-03-14	Elmhurst, Illinois, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8484412.png	L	184	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10833	10833	\N	\N
10624	calum-ritchie	Calum Ritchie	C	326	8484221	\N	950000	2028	2	2005-01-21	Oakville, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8484221.png	R	200	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10258	10258	\N	\N
9981	atley-calvert	Atley Calvert	C	325	\N	\N	930000	2028	2	2003-09-17	\N	6'1	\N	R	194	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10326	10326	\N	\N
545	noah-warren	Noah Warren	D	317	8483521	47	896667	2027	1	2004-07-15	Montréal, Quebec, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8483521.png	R	224	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9197	9197	\N	\N
578	riley-fiddler-schultz	Riley Fiddler-schultz	L	315	8483090	45	902500	2027	1	2002-05-13	Edmonton, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8483090.png	L	197	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9923	9923	\N	\N
5238	otto-stenberg	Otto Stenberg	F	319	8484230	\N	950000	2028	2	2005-05-29	Stenungsund, SWE	5'11"	https://assets.nhle.com/mugs/nhl/20262027/STL/8484230.png	L	188	C/LW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10495	10495	\N	\N
10085	owen-pickering	Owen Pickering	D	325	8483503	\N	950000	2027	1	2004-01-27	St. Adolphe, Manitoba, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8483503.png	L	206	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9673	9673	\N	\N
201	tyler-boucher	Tyler Boucher	R	297	8482674	54	850000	2027	1	2003-01-16	Scottsdale, Arizona, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8482674.png	R	216	LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8987	8987	\N	\N
682	zakhar-bardakov	Zakhar Bardakov	L	303	8482947	93	867500	2026	0	2001-02-24	Berdsk, RUS	6'2"	https://assets.nhle.com/mugs/nhl/20262027/COL/8482947.png	L	198	C	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10952	10952	\N	\N
666	oliver-moore	Oliver Moore	F	316	8484197	11	941667	2027	1	2005-01-22	Mounds View, Minnesota, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8484197.png	L	188	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10891	10891	\N	\N
4801	felix-unger-sorum	Felix Unger Sorum	R	300	8484392	\N	860000	2028	2	2005-09-14	Trondheim, NOR	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8484392.png	R	190	LW/RW	NOR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10462	10462	\N	\N
4951	francesco-pinelli	Francesco Pinelli	F	313	8482748	\N	850000	2027	1	2003-04-11	Hamilton, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8482748.png	L	185	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9239	9239	\N	\N
5253	martin-misiak	Martin Misiak	F	316	8484195	\N	895000	2027	1	2004-09-30	Banská Bystrica, SVK	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8484195.png	L	194	RW	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10142	10142	\N	\N
5182	lukas-reichel	Lukas Reichel	C	314	8482117	\N	950000	2027	1	2002-05-17	Nürnberg, DEU	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8482117.png	L	170	LW	DEU	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8847	8847	\N	\N
5037	curtis-mckenzie	Curtis Mckenzie	F	321	8475310	\N	700000	2021	0	1991-02-22	Golden, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8475310.png	L	205	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4883	4883	\N	\N
374	luke-haymes	Luke Haymes	C	322	8485467	43	906250	2027	1	2003-07-28	Ottawa, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8485467.png	L	192	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10525	10525	\N	\N
234	jacob-gaucher	Jacob Gaucher	F	310	8481848	78	850000	2027	1	2001-03-09	Longueuil, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8481848.png	R	185	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9378	9378	\N	\N
5436	aaron-ness	Aaron Ness	D	307	8474604	\N	725000	2021	0	1990-05-18	Roseau, Minnesota, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8474604.png	L	184	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4026	4026	\N	\N
5701	wyatte-wylie	Wyatte Wylie	D	309	8480984	\N	820833	2023	0	1999-11-02	Everett, Washington, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8480984.png	R	190	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7849	7849	\N	\N
4995	hugh-mcging	Hugh Mcging	F	329	8481070	\N	775000	2026	0	1998-07-11	Chicago, Illinois, USA	5'8"	https://assets.nhle.com/mugs/nhl/20262027/STL/8481070.png	L	174	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8461	8461	\N	hugh-mcging
5360	kyle-mcdonald	Kyle Mcdonald	R	329	8483799	\N	870000	2026	0	2002-02-05	Ottawa, Ontario, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8483799.png	R	209	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9964	9964	\N	kyle-mcdonald
4864	jimmy-huntington	Jimmy Huntington	F	329	8481228	\N	850000	2027	1	1998-11-18	Laval, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8481228.png	L	200	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7897	7897	\N	jimmy-huntington
4851	philippe-daoust	Philippe Daoust	C	329	8482458	\N	850000	2027	1	2001-11-05	Barrie, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8482458.png	L	195	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8861	8861	\N	philippe-daoust
5012	antti-tuomisto	Antti Tuomisto	D	329	8481587	\N	875000	2028	2	2001-01-20	Pori, FIN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/DET/8481587.png	R	217	D	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9973	9973	\N	antti-tuomisto
433	max-sasson	Max Sasson	C	329	8484136	63	1000000	2028	2	2000-09-05	Birmingham, Michigan, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8484136.png	L	181	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9659	9659	\N	max-sasson
4868	colin-white	Colin White	C	329	8478400	\N	775000	2026	0	1997-01-30	Boston, Massachusetts, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8478400.png	R	195	C/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6669	6669	\N	colin-white
5146	gabriel-seger	Gabriel Seger	L	304	8484989	\N	\N	\N	\N	1999-11-15	Uppsala, SWE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/DET/8484989.png	L	216	C/LW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10475	10475	\N	\N
5544	fabian-wagner	Fabian Wagner	L	311	8483520	\N	858333	2027	1	2004-05-07	Nykoping, SWE	5'10"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8483520.png	L	170	C/RW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10483	10483	\N	\N
10016	rutger-mcgroarty	Rutger Mcgroarty	L	325	8483487	\N	950000	2027	1	2004-03-30	Lincoln, Nebraska, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8483487.png	L	212	C/LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10472	10472	\N	\N
13285	michal-postava	MICHAL POSTAVA	G	304	8485545	\N	975000	2027	1	2002-02-28	Valašské Meziříčí, CZE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/DET/8485545.png	L	200	\N	CZE	https://frozenpool.dobbersports.com/players/michal-postava	\N	\N	\N
13323	scott-ratzlaff	SCOTT RATZLAFF	G	315	8484218	\N	865000	2028	2	2005-03-09	Irma, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8484218.png	L	188	\N	CAN	https://frozenpool.dobbersports.com/players/scott-ratzlaff	\N	\N	\N
13314	owen-say	OWEN SAY	G	329	8485465	\N	872500	2026	0	2001-06-05	London, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8485465.png	L	185	\N	CAN	https://frozenpool.dobbersports.com/players/owen-say	\N	\N	owen-say
144	dougie-hamilton	Dougie Hamilton	D	329	8476462	7	9000000	2028	2	1993-06-17	Toronto, Ontario, CAN	6'6"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8476462.png	R	230	D	CAN	\N	\N	\N	dougie-hamilton
189	adam-fox	Adam Fox	D	329	8479323	23	9500000	2029	3	1998-02-17	Jericho, New York, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8479323.png	R	185	D	USA	\N	\N	\N	adam-fox
5340	nick-poisson	Nick Poisson	C	295	\N	\N	\N	\N	\N	2001-08-15	\N	5.11	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10931	10931	\N	\N
62	danila-yurov	Danila Yurov	R	20	8483525	22	950000	2028	2	2003-12-22	Chelyabinsk, RUS	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8483525.png	L	178	RW	RUS	\N	\N	\N	\N
13224	juho-lammikko	Juho Lammikko	RW	329	8477996	\N	800000	2026	0	1996-01-29	Noormarkku, FIN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8477996.png	L	191	C	FIN	https://frozenpool.dobbersports.com/players/juho-lammikko	\N	\N	juho-lammikko
13219	ryan-reaves	Ryan Reaves	RW	329	8471817	\N	1350000	2026	0	1987-01-20	Winnipeg, Manitoba, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8471817.png	R	225	RW	CAN	https://frozenpool.dobbersports.com/players/ryan-reaves	\N	\N	ryan-reaves
13171	tyson-jost	Tyson Jost	C	329	8479370	\N	775000	2026	0	1998-03-14	St. Albert, Alberta, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8479370.png	L	187	C	CAN	https://frozenpool.dobbersports.com/players/tyson-jost	\N	\N	tyson-jost
9874	matt-luff	Matt Luff	R	329	8479644	\N	850000	2027	1	1997-05-05	Oakville, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8479644.png	R	219	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6733	6733	\N	matt-luff
117	steven-stamkos	Steven Stamkos	C	329	8474564	91	8000000	2028	2	1990-02-07	Markham, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8474564.png	R	193	C/LW/RW	CAN	\N	\N	\N	steven-stamkos
4876	anthony-richard	Anthony Richard	L	329	8478409	\N	775000	2026	0	1996-12-20	Trois-Rivières, Quebec, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8478409.png	L	185	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6342	6342	\N	anthony-richard
13268	cayden-primeau	Cayden Primeau	G	2	8480051	\N	775000	2026	0	1999-08-11	Farmington Hills, Michigan, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8480051.png	L	205	\N	USA	https://frozenpool.dobbersports.com/players/cayden-primeau	\N	\N	\N
13288	isak-posch	ISAK POSCH	G	303	8485473	\N	910000	2027	1	2002-01-31	Umea, SWE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/COL/8485473.png	L	209	\N	SWE	https://frozenpool.dobbersports.com/players/isak-posch	\N	\N	\N
13333	hampton-slukynsky	HAMPTON SLUKYNSKY	G	313	8484417	\N	1228767	2029	3	2005-07-02	Roseau, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8484417.png	L	179	\N	USA	https://frozenpool.dobbersports.com/players/hampton-slukynsky	\N	\N	\N
5477	lucas-johansen	Lucas Johansen	D	306	8479321	\N	762500	2024	0	1997-11-16	Vancouver, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8479321.png	L	176	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6787	6787	\N	\N
5342	samuel-johannesson	Samuel Johannesson	D	319	8482499	\N	870000	2026	0	2000-12-27	SWE	5'11"	https://assets.nhle.com/mugs/nhl/20262027/STL/8482499.png	R	184	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10331	10331	\N	\N
5483	rasmus-kumpulainen	Rasmus Kumpulainen	F	308	8484184	\N	897500	2028	2	2005-08-08	Lahti, FIN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8484184.png	L	191	C	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10917	10917	\N	\N
66	viking-gustafsson-nyberg	Viking Gustafsson Nyberg	D	308	8486166	6	975000	2027	1	2003-09-21	Stockholm, SWE	6'6"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8486166.png	L	225	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11052	11052	\N	\N
212	oskar-pettersson	Oskar Pettersson	R	297	8483673	63	865000	2027	1	2004-02-04	Halmstad, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8483673.png	R	209	RW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10016	10016	\N	\N
5724	christian-fitzgerald	Christian Fitzgerald	F	321	8486174	\N	952500	2027	1	2002-05-31	Coquitlam, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8486174.png	L	186	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11084	11084	\N	\N
4875	william-stromgren	William Stromgren	L	298	8482766	\N	850000	2027	1	2003-06-07	Ornskoldsvik, SWE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8482766.png	L	175	LW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9669	9669	\N	\N
5350	david-goyette	David Goyette	F	302	8483449	\N	923333	2027	1	2004-03-27	Saint-Jerome, Quebec, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8483449.png	L	172	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9710	9710	\N	\N
244	oliver-bonk	Oliver Bonk	D	310	8484148	59	950000	2028	2	2005-01-09	Ottawa, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8484148.png	R	180	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10722	10722	\N	\N
5348	caden-price	Caden Price	D	302	8484217	\N	865833	2028	2	2005-08-24	Saskatoon, Saskatchewan, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8484217.png	L	186	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10183	10183	\N	\N
13157	david-perron	David Perron	LW	329	8474102	\N	4000000	2026	0	1988-05-28	Sherbrooke, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8474102.png	R	202	LW/RW	CAN	https://frozenpool.dobbersports.com/players/david-perron	\N	\N	david-perron
5081	josiah-slavin	Josiah Slavin	L	329	8481004	\N	775000	2026	0	1998-12-31	Erie, Colorado, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8481004.png	L	205	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8645	8645	\N	josiah-slavin
13307	magnus-chrona	MAGNUS CHRONA	G	329	8480992	\N	855000	2026	0	2000-08-28	Stockholm, SWE	6'6"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8480992.png	L	225	\N	SWE	https://frozenpool.dobbersports.com/players/magnus-chrona	\N	\N	magnus-chrona
13136	marcus-johansson	Marcus Johansson	C	329	8475149	\N	800000	2026	0	1990-10-06	Landskrona, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8475149.png	L	203	C/LW	SWE	https://frozenpool.dobbersports.com/players/marcus-johansson	\N	\N	marcus-johansson
5021	oskar-olausson	Oskar Olausson	F	329	8482712	\N	925000	2026	0	2002-11-10	Stockholm, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8482712.png	L	180	C/RW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9154	9154	\N	oskar-olausson
5295	sonny-milano	Sonny Milano	L	329	8477947	\N	1900000	2026	0	1996-05-12	Massapequa, New York, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8477947.png	L	205	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5856	5856	\N	sonny-milano
4936	angus-crookshank	Angus Crookshank	L	329	8481065	\N	812500	2027	1	1999-10-02	North Vancouver, British Columbia, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8481065.png	L	183	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8648	8648	\N	angus-crookshank
5415	dakota-mermis	Dakota Mermis	D	329	8477541	\N	812500	2027	1	1994-01-05	Alton, Illinois, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8477541.png	L	197	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6014	6014	\N	dakota-mermis
5479	marshall-rifai	Marshall Rifai	D	329	8483546	\N	812500	2027	1	1998-03-16	Beaconsfield, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8483546.png	L	211	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9072	9072	\N	marshall-rifai
7	mattias-janmark	Mattias Janmark	C	329	8477406	13	1450000	2027	1	1992-12-08	Danderyd, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8477406.png	L	205	C/LW/RW	SWE	\N	\N	\N	mattias-janmark
5042	marc-del-gaizo	Marc Del Gaizo	D	329	8481743	\N	875000	2028	2	1999-10-11	Basking Ridge, New Jersey, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8481743.png	L	188	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8717	8717	\N	marc-del-gaizo
5525	zakary-karpa	Zakary Karpa	F	305	\N	\N	\N	\N	\N	2002-03-25	\N	5.11	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10786	10786	\N	\N
5758	kale-kessy	Kale Kessy	L	319	8476353	\N	630000	2016	0	1992-12-04	Shaunavon, Saskatchewan, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/STL/8476353.png	L	212	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5039	5039	\N	\N
13337	damian-clara	DAMIAN CLARA	G	317	8484391	\N	878333	2028	2	2005-01-13	Brunico, ITA	6'6"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8484391.png	L	214	\N	ITA	https://frozenpool.dobbersports.com/players/damian-clara	\N	\N	\N
5266	carter-king	Carter King	C	329	8485510	\N	872500	2026	0	2001-08-30	Calgary, Alberta, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8485510.png	L	190	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10626	10626	\N	carter-king
5682	neil-shea	Neil Shea	F	303	8484116	\N	\N	\N	\N	1999-07-29	Marshfield, Massachusetts, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/COL/8484116.png	L	201	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9613	9613	\N	\N
5075	bryce-mcconnell-barker	Bryce Mcconnell-barker	F	305	8483486	\N	870000	2027	1	2004-06-04	London, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8483486.png	L	191	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9667	9667	\N	\N
184	adam-sykora	Adam Sykora	F	305	8483669	38	870000	2027	1	2004-09-07	Piestany, SVK	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8483669.png	L	193	C/LW	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9666	9666	\N	\N
5781	ryan-mcguire	Ryan Mcguire	F	308	8482218	\N	\N	\N	\N	2002-07-27	Sainte-Agathe-des-Monts, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8482218.png	R	176	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10916	10916	\N	\N
671	dominic-toninato	Dominic Toninato	C	329	8476952	25	850000	2027	1	1994-03-09	Duluth, Minnesota, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8476952.png	L	201	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6813	6813	\N	dominic-toninato
5639	brendan-smith	Brendan Smith	D	329	8474090	\N	800000	2026	0	1989-02-08	Mimico, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8474090.png	L	200	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=3750	3750	\N	brendan-smith
4889	graeme-clarke	Graeme Clarke	R	329	8481578	\N	775000	2026	0	2001-04-24	Waconia, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8481578.png	R	175	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8598	8598	\N	graeme-clarke
13188	gustav-nyquist	Gustav Nyquist	RW	329	8474679	\N	3250000	2026	0	1989-09-01	Halmstad, SWE	5'11"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8474679.png	L	180	LW/RW	SWE	https://frozenpool.dobbersports.com/players/gustav-nyquist	\N	\N	gustav-nyquist
5017	jakub-rychlovsky	Jakub Rychlovsky	L	329	8484966	\N	870000	2026	0	2001-08-07	Vrchlabi, CZE	5'11"	https://assets.nhle.com/mugs/nhl/20262027/DET/8484966.png	L	196	LW	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10453	10453	\N	jakub-rychlovsky
5202	john-farinacci	John Farinacci	C	329	8481558	\N	775000	2026	0	2001-02-14	Red Bank, New Jersey, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8481558.png	R	184	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9831	9831	\N	john-farinacci
4924	nicolas-aube-kubel	Nicolas Aube-kubel	R	329	8477979	\N	775000	2026	0	1996-05-10	Slave Lake, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8477979.png	R	213	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6304	6304	\N	nicolas-aube-kubel
5613	noah-beck	Noah Beck	D	329	8482468	\N	975000	2026	0	2001-03-25	Richmond Hill, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8482468.png	L	184	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10543	10543	\N	noah-beck
5273	ryan-mast	Ryan Mast	D	329	8482893	\N	850000	2026	0	2003-01-14	Bloomfield Hills, Michigan, USA	6'5"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8482893.png	R	221	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9827	9827	\N	ryan-mast
481	alex-ovechkin	Alex Ovechkin	L	329	8471214	8	4250000	2027	1	1985-09-17	Moscow, RUS	6'3"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8471214.png	R	238	LW/RW	RUS	\N	\N	\N	alex-ovechkin
752	andrew-copp	Andrew Copp	C	329	8477429	18	5625000	2027	1	1994-07-08	Ann Arbor, Michigan, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/DET/8477429.png	L	200	C/LW/RW	USA	\N	\N	\N	andrew-copp
474	anthony-beauvillier	Anthony Beauvillier	R	329	8478463	72	2750000	2027	1	1997-06-08	Sorel-Tracy, Quebec, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8478463.png	L	181	LW/RW	CAN	\N	\N	\N	anthony-beauvillier
5210	billy-sweezey	Billy Sweezey	D	329	8482399	\N	850000	2027	1	1996-02-06	Hanson, Massachusetts, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8482399.png	R	202	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8462	8462	\N	billy-sweezey
143	brenden-dillon	Brenden Dillon	D	329	8475455	5	4000000	2027	1	1990-11-13	New Westminster, British Columbia, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8475455.png	L	225	D	CAN	\N	\N	\N	brenden-dillon
217	cameron-crotty	Cameron Crotty	D	329	8480075	5	812500	2027	1	1999-05-05	Ottawa, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8480075.png	R	213	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8412	8412	\N	cameron-crotty
4796	cameron-hughes	Cameron Hughes	F	329	8478888	\N	812500	2027	1	1996-10-09	Edmonton, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8478888.png	L	190	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7016	7016	\N	cameron-hughes
747	casey-desmith	Casey DeSmith	G	329	8479193	1	1016667	2027	1	1991-08-13	Rochester, New Hampshire, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8479193.png	L	188	\N	USA	\N	\N	\N	casey-desmith
5113	casey-fitzgerald	Casey Fitzgerald	D	329	8479578	\N	850000	2027	1	1997-02-25	North Reading, Massachusetts, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8479578.png	R	188	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7569	7569	\N	casey-fitzgerald
5740	frank-djurasevic	Frank Djurasevic	D	322	\N	\N	\N	\N	\N	2002-03-09	\N	6.02	\N	R	198	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11018	11018	\N	\N
5373	connor-mylymok	Connor Mylymok	L	329	\N	\N	850000	2027	1	2000-03-18	\N	6.02	\N	L	208	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10317	10317	\N	connor-mylymok
5304	jacob-macdonald	Jacob Macdonald	D	329	8479439	\N	850000	2027	1	1993-02-26	Portland, Oregon, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/COL/8479439.png	L	204	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6340	6340	\N	jacob-macdonald
351	jansen-harkins	Jansen Harkins	C	329	8478424	\N	850000	2027	1	1997-05-23	Cleveland, Ohio, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8478424.png	L	197	C	USA	\N	\N	\N	jansen-harkins
735	joel-kiviranta	Joel Kiviranta	L	329	8481641	25	1000000	2027	1	1996-03-23	Vantaa, FIN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8481641.png	L	185	LW/RW	FIN	\N	\N	\N	joel-kiviranta
414	john-marino	John Marino	D	329	8478507	6	4400000	2027	1	1997-05-21	North Easton, Massachusetts, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8478507.png	R	200	D	USA	\N	\N	\N	john-marino
5475	kyle-burroughs	Kyle Burroughs	D	329	8477335	\N	850000	2027	1	1995-07-12	Vancouver, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8477335.png	R	193	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5478	5478	\N	kyle-burroughs
5218	lucas-condotta	Lucas Condotta	L	329	8483549	\N	850000	2027	1	1997-11-06	Georgetown, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8483549.png	L	218	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9093	9093	\N	lucas-condotta
5363	montana-onyebuchi	Montana Onyebuchi	D	329	8481159	\N	812500	2027	1	2000-03-08	Winnipeg, Manitoba, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8481159.png	R	201	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8740	8740	\N	montana-onyebuchi
9946	ville-koivunen	Ville Koivunen	L	325	8482758	\N	850833	2026	0	2003-06-13	Oulu, FIN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8482758.png	L	184	RW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9649	9649	\N	\N
4846	nick-abruzzese	Nick Abruzzese	L	329	8481720	\N	850000	2027	1	1999-06-04	Slate Hill, New York, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8481720.png	L	178	C/LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9563	9563	\N	nick-abruzzese
443	nikita-tolopilo	Nikita Tolopilo	G	329	8484268	60	812500	2027	1	2000-04-06	Minsk, BLR	6'6"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8484268.png	L	229	\N	BLR	\N	\N	\N	nikita-tolopilo
5067	parker-ford	Parker Ford	R	329	8484135	\N	812500	2027	1	2000-07-20	Wakefield, Rhode Island, USA	5'9"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8484135.png	R	181	C/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9656	9656	\N	parker-ford
4970	sam-colangelo	Sam Colangelo	F	329	8482118	\N	850000	2027	1	2001-12-26	Stoneham, Massachusetts, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8482118.png	R	213	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10096	10096	\N	sam-colangelo
13257	spencer-martin	Spencer Martin	G	329	8477484	\N	812500	2027	1	1995-06-08	Oakville, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8477484.png	L	191	\N	CAN	https://frozenpool.dobbersports.com/players/spencer-martin	\N	\N	spencer-martin
5315	spencer-smallman	Spencer Smallman	C	329	8478867	\N	812500	2027	1	1996-09-09	Summerside, Prince Edward Island, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8478867.png	R	205	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6910	6910	\N	spencer-smallman
383	colton-sissons	Colton Sissons	C	329	8476925	\N	4250000	2028	2	1993-11-05	North Vancouver, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8476925.png	R	200	C/RW	CAN	\N	\N	\N	colton-sissons
26	quinton-byfield	Quinton Byfield	R	329	8482124	55	6250000	2029	3	2002-08-19	Newmarket, Ontario, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8482124.png	L	230	C/RW	CAN	\N	\N	\N	quinton-byfield
215	fabian-zetterlund	Fabian Zetterlund	L	329	8480188	20	4275000	2028	2	1999-08-25	Karlstad, SWE	5'11"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8480188.png	R	208	LW/RW	SWE	\N	\N	\N	fabian-zetterlund
564	jonathan-aspirot	Jonathan Aspirot	D	329	8481219	45	887500	2028	2	1999-05-16	Mascouche, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8481219.png	L	212	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7786	7786	\N	jonathan-aspirot
638	nicolas-deslauriers	Nicolas Deslauriers	L	329	8475235	44	875000	2028	2	1991-02-22	LaSalle, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8475235.png	L	218	LW	CAN	\N	\N	\N	nicolas-deslauriers
4881	sheldon-dries	Sheldon Dries	C	329	8480326	\N	875000	2028	2	1994-04-23	Macomb, Michigan, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/DET/8480326.png	L	182	C/LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6856	6856	\N	sheldon-dries
654	sean-walker	Sean Walker	D	329	8480336	26	3615000	2029	3	1994-11-13	Keswick, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8480336.png	R	191	D	CAN	\N	\N	\N	sean-walker
410	vincent-trocheck	Vincent Trocheck	C	329	8476389	\N	5625000	2029	3	1993-07-11	Pittsburgh, Pennsylvania, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8476389.png	R	187	C	USA	\N	\N	\N	vincent-trocheck
65	brock-faber	Brock Faber	D	20	8482122	7	8500000	2033	7	2002-08-22	Maple Grove, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8482122.png	R	200	D	USA	\N	\N	\N	\N
169	matthew-schaefer	Matthew Schaefer	D	24	8485366	48	975000	2028	2	2007-09-05	Hamilton, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8485366.png	L	186	D	CAN	\N	\N	\N	\N
13298	amir-miftakhov	AMIR MIFTAKHOV	G	329	8482501	\N	775000	2026	0	2000-04-26	Kazan, RUS	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8482501.png	L	184	\N	RUS	https://frozenpool.dobbersports.com/players/amir-miftakhov	\N	\N	amir-miftakhov
13208	david-tomasek	David Tomasek	F	329	8485493	\N	1200000	2026	0	1996-02-10	Praha, CZE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8485493.png	R	210	RW	CZE	https://frozenpool.dobbersports.com/players/david-tomasek	\N	\N	david-tomasek
5249	garrett-wilson	Garrett Wilson	L	329	8475253	\N	775000	2026	0	1991-03-16	Barrie, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8475253.png	L	218	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4334	4334	\N	garrett-wilson
4853	t-j-tynan	T.j. Tynan	F	329	8476391	\N	775000	2026	0	1992-02-25	Orland Park, Illinois, USA	5'8"	https://assets.nhle.com/mugs/nhl/20262027/COL/8476391.png	R	160	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5540	5540	\N	t-j-tynan
4912	valtteri-puustinen	Valtteri Puustinen	R	329	8481703	\N	775000	2026	0	1999-06-04	Kuopio, FIN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/COL/8481703.png	R	180	RW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8793	8793	\N	valtteri-puustinen
262	andrei-kuzmenko	Andrei Kuzmenko	L	329	8483808	\N	5000000	2027	1	1996-02-04	Yakutsk, RUS	5'11"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8483808.png	R	200	LW	RUS	\N	\N	\N	andrei-kuzmenko
5334	mackenzie-entwistle	Mackenzie Entwistle	R	329	8480025	\N	812500	2027	1	1999-07-14	Georgetown, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8480025.png	R	203	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8011	8011	\N	mackenzie-entwistle
9	mathieu-joseph	Mathieu Joseph	F	329	8478472	21	1000000	2027	1	1997-02-09	Laval, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/STL/8478472.png	L	189	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6791	6791	\N	mathieu-joseph
107	ross-colton	Ross Colton	C	329	8479525	\N	4000000	2027	1	1996-09-11	Robbinsville, New Jersey, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8479525.png	L	194	C/LW/RW	USA	\N	\N	\N	ross-colton
562	alex-steeves	Alex Steeves	C	329	8482634	21	1625000	2028	2	1999-12-10	Saint Paul, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8482634.png	L	199	C/LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8883	8883	\N	alex-steeves
253	carson-bjarnason	Carson Bjarnason	G	27	8484147	64	913333	2028	2	2005-06-30	Brandon, Manitoba, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8484147.png	L	186	\N	CAN	\N	\N	\N	\N
266	tommy-novak	Tommy Novak	C	329	8478438	18	3500000	2027	1	1997-04-28	St. Paul, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8478438.png	L	190	C	USA	\N	\N	\N	tommy-novak
57	kirill-kaprizov	Kirill Kaprizov	L	20	8478864	97	17000000	2034	8	1997-04-26	Novokuznetsk, RUS	5'10"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8478864.png	L	202	LW	RUS	\N	\N	\N	\N
39	mikey-anderson	Mikey Anderson	D	19	8479998	44	4125000	2031	5	1999-05-25	Roseville, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8479998.png	L	195	D	USA	\N	\N	\N	\N
38	mats-zuccarello	Mats Zuccarello	C	329	8475692	\N	1000000	2027	1	1987-09-01	Oslo, NOR	5'8"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8475692.png	L	181	LW/RW	NOR	\N	\N	\N	mats-zuccarello
661	anton-frondell	Anton Frondell	C	12	8485391	16	975000	2028	2	2007-05-07	Trangsund, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8485391.png	L	198	C	SWE	\N	\N	\N	\N
604	alex-lyon	Alex Lyon	G	329	8479312	34	1500000	2027	1	1992-12-09	Baudette, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8479312.png	L	199	\N	USA	\N	\N	\N	alex-lyon
13347	mattias-sholl	MATTIAS SHOLL	G	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/mattias-sholl	\N	\N	\N
807	matthew-tkachuk	Matthew Tkachuk	L	18	8479314	19	9500000	2030	4	1997-12-11	Scottsdale, Arizona, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8479314.png	L	202	LW/RW	USA	\N	\N	\N	\N
730	radek-faksa	Radek Faksa	C	329	8476889	12	2000000	2028	2	1994-01-09	Vitkov, CZE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8476889.png	L	216	C	CZE	\N	\N	\N	radek-faksa
83	kirby-dach	Kirby Dach	C	329	8481523	77	3600000	2027	1	2001-01-21	Fort Saskatchewan, Alberta, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8481523.png	R	221	C/RW	CAN	\N	\N	\N	kirby-dach
53	marcus-foligno	Marcus Foligno	L	329	8475220	17	4000000	2028	2	1991-08-10	Buffalo, New York, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8475220.png	L	226	LW/RW	USA	\N	\N	\N	marcus-foligno
5739	ethan-leyh	Ethan Leyh	L	300	\N	\N	\N	\N	\N	2001-09-07	\N	6.00	\N	L	195	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10776	10776	\N	\N
197	joonas-korpisalo	Joonas Korpisalo	G	329	8476914	70	4000000	2028	2	1994-04-28	Pori, FIN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8476914.png	L	200	\N	FIN	\N	\N	\N	joonas-korpisalo
121	nicolas-hague	Nicolas Hague	D	329	8479980	41	5500000	2029	3	1998-12-05	Kitchener, Ontario, CAN	6'6"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8479980.png	L	245	D	CAN	\N	\N	\N	nicolas-hague
13353	c-j-kier	C.J. KIER	G	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/c-j-kier	\N	\N	\N
100	jayden-struble	Jayden Struble	D	21	8481593	47	1412500	2027	1	2001-09-08	Cumberland, Rhode Island, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8481593.png	L	207	D	USA	\N	\N	\N	\N
16	mattias-ekholm	Mattias Ekholm	D	329	8475218	14	4000000	2029	3	1990-05-24	Borlange, SWE	6'5"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8475218.png	L	225	D	SWE	\N	\N	\N	mattias-ekholm
89	juraj-slafkovsk	Juraj Slafkovský	L	21	8483515	20	\N	\N	\N	2004-03-30	Kosice, SVK	6'3"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8483515.png	L	225	LW/RW	SVK	\N	\N	\N	\N
702	mackenzie-blackwood	Mackenzie Blackwood	G	13	8478406	39	5250000	2030	4	1996-12-09	Thunder Bay, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/COL/8478406.png	L	225	\N	CAN	\N	\N	\N	\N
52	joel-eriksson-ek	Joel Eriksson Ek	C	329	8478493	14	5250000	2029	3	1997-01-29	Karlstad, SWE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8478493.png	L	207	C	SWE	\N	\N	\N	joel-eriksson-ek
179	alexis-lafrenire	Alexis Lafrenière	L	25	8482109	13	\N	\N	\N	2001-10-11	St-Eustache, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8482109.png	L	191	LW/RW	CAN	\N	\N	\N	\N
34	artemi-panarin	Artemi Panarin	L	329	8478550	10	11000000	2028	2	1991-10-30	Korkino, RUS	6'0"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8478550.png	R	176	LW	RUS	\N	\N	\N	artemi-panarin
86	jake-evans	Jake Evans	C	329	8478133	71	2850000	2029	3	1996-06-02	Toronto, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8478133.png	R	190	C	CAN	\N	\N	\N	jake-evans
12	vasily-podkolzin	Vasily Podkolzin	R	329	8481617	92	2950000	2029	3	2001-06-24	Moscow, RUS	6'1"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8481617.png	L	190	LW/RW	RUS	\N	\N	\N	vasily-podkolzin
154	emil-heineman	Emil Heineman	L	24	8482476	51	1100000	2027	1	2001-11-16	Leksand, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8482476.png	L	204	LW/RW	SWE	\N	\N	\N	\N
126	adam-wilsby	Adam Wilsby	D	22	8482482	83	812500	2027	1	2000-08-07	Stockholm, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8482482.png	L	188	D	SWE	\N	\N	\N	\N
4837	cameron-hebig	Cameron Hebig	C	329	\N	\N	812500	2027	1	1997-01-21	\N	5.10	\N	R	184	RW	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7401	7401	\N	cameron-hebig
4897	eduards-tralmaks	Eduards Tralmaks	L	329	8482631	\N	850000	2027	1	1997-02-17	Riga, LVA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DET/8482631.png	L	221	LW	LVA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8654	8654	\N	eduards-tralmaks
4934	ty-mueller	Ty Mueller	C	295	8484406	\N	895000	2027	1	2003-02-26	Edmonton, Alberta, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8484406.png	L	185	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10089	10089	\N	\N
13223	connor-ingram	Connor Ingram	G	329	8478971	\N	1950000	2026	0	1997-03-31	Saskatoon, Saskatchewan, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8478971.png	L	218	\N	CAN	https://frozenpool.dobbersports.com/players/connor-ingram	\N	\N	connor-ingram
5008	olle-lycksell	Olle Lycksell	R	329	8480245	\N	775000	2026	0	1999-08-24	Oskarshamn, SWE	5'11"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8480245.png	L	197	RW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9485	9485	\N	olle-lycksell
220	jake-sanderson	Jake Sanderson	D	26	8482105	85	8050000	2032	6	2002-07-08	Whitefish, Montana, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8482105.png	L	202	D	USA	\N	\N	\N	\N
161	kyle-palmieri	Kyle Palmieri	C	329	8475151	21	4750000	2027	1	1991-02-01	Smithtown, New York, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8475151.png	R	192	C	USA	\N	\N	\N	kyle-palmieri
5347	beau-akey	Beau Akey	D	296	8484139	\N	895000	2028	2	2005-02-11	Waterloo, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8484139.png	R	173	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10880	10880	\N	\N
5404	max-mccue	Max Mccue	C	301	8482881	\N	883333	2027	1	2003-02-10	Sudbury, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8482881.png	L	182	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10471	10471	\N	\N
5489	will-dineen	Will Dineen	F	309	8445909	\N	\N	\N	\N	1932-09-18	Arvida, Quebec, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8445909.png	R	180	LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10505	10505	\N	\N
130	jesper-boqvist	Jesper Boqvist	C	329	8480003	70	1500000	2027	1	1998-10-30	Falun, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8480003.png	L	191	C/LW	SWE	\N	\N	\N	jesper-boqvist
211	kurtis-macdermid	Kurtis MacDermid	L	329	8477073	23	1150000	2027	1	1994-03-25	Quebec City, Quebec, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8477073.png	L	233	LW	CAN	\N	\N	\N	kurtis-macdermid
5596	jake-boltmann	Jake Boltmann	D	318	\N	\N	\N	\N	\N	2001-10-19	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10981	10981	\N	\N
216	thomas-chabot	Thomas Chabot	D	329	8478469	72	8000000	2028	2	1997-01-30	Sainte-Marie, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8478469.png	L	200	D	CAN	\N	\N	\N	thomas-chabot
214	tim-sttzle	Tim Stützle	C	26	8482116	18	\N	\N	\N	2002-01-15	Viersen, DEU	6'0"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8482116.png	L	187	C/LW	DEU	\N	\N	\N	\N
10306	tanner-howe	Tanner Howe	L	325	8484869	\N	875000	2029	3	2005-11-28	Prince Albert, Saskatchewan, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8484869.png	L	183	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10962	10962	\N	\N
5793	troy-murray	Troy Murray	F	319	8449773	\N	\N	\N	\N	1962-07-31	Calgary, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/STL/8449773.png	R	195	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10941	10941	\N	\N
192	marcus-pettersson	Marcus Pettersson	D	25	8477969	26	5500000	2031	5	1996-05-08	Skelleftea, SWE	6'5"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8477969.png	L	174	D	SWE	\N	\N	\N	\N
156	bo-horvat	Bo Horvat	C	24	8477500	14	8500000	2031	5	1995-04-05	London, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8477500.png	L	225	C	CAN	\N	\N	\N	\N
4859	sam-poulin	Sam Poulin	C	329	8481591	\N	850000	2027	1	2001-02-25	Blainville, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8481591.png	L	217	LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8890	8890	\N	sam-poulin
5536	carter-wilkie	Carter Wilkie	C	298	\N	\N	\N	\N	\N	2000-04-03	\N	6.02	\N	R	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10547	10547	\N	\N
5120	juuso-valimaki	Juuso Valimaki	D	329	8479976	\N	900000	2027	1	1998-10-06	Tampere, FIN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8479976.png	L	201	D	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7490	7490	\N	juuso-valimaki
5184	nikita-novikov	Nikita Novikov	D	329	8482916	\N	867500	2026	0	2003-07-25	Moscow, RUS	6'5"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8482916.png	L	222	D	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9930	9930	\N	nikita-novikov
13148	andr-burakovsky	Andr� Burakovsky	LW	12	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/andr-burakovsky	\N	\N	\N
148	jonas-siegenthaler	Jonas Siegenthaler	D	329	8478399	71	3400000	2028	2	1997-05-06	Zurich, CHE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8478399.png	L	218	D	CHE	\N	\N	\N	jonas-siegenthaler
226	linus-ullmark	Linus Ullmark	G	329	8476999	35	8250000	2029	3	1993-07-31	Lugnvik, SWE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8476999.png	L	223	\N	SWE	\N	\N	\N	linus-ullmark
13176	olli-m-tt	Olli M��tt�	D	34	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/olli-m-tt	\N	\N	\N
131	jesper-bratt	Jesper Bratt	L	23	8479407	63	7875000	2031	5	1998-07-30	Stockholm, SWE	5'10"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8479407.png	L	175	LW/RW	SWE	\N	\N	\N	\N
185	joe-veleno	Joe Veleno	C	329	8480813	90	1200000	2027	1	2000-01-13	Montréal, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8480813.png	L	201	C	CAN	\N	\N	\N	joe-veleno
13190	erik-ern-k	Erik ?ern�k	D	32	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/erik-ern-k	\N	\N	\N
5009	william-villeneuve	William Villeneuve	D	322	8482174	\N	875000	2028	2	2002-03-20	Sherbrooke, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8482174.png	R	183	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8738	8738	\N	\N
5243	zach-aston-reese	Zach Aston-reese	L	329	8479944	\N	875000	2028	2	1994-08-10	Staten Island, New York, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8479944.png	L	203	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6644	6644	\N	zach-aston-reese
4928	cross-hanas	Cross Hanas	F	321	8482106	\N	859167	2025	0	2002-01-05	Dallas, Texas, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8482106.png	L	171	C/LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9548	9548	\N	\N
5375	ivan-ryabkin	Ivan Ryabkin	C	300	8485368	\N	918333	2029	3	2007-04-25	Balakovo, RUS	5'11"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8485368.png	L	185	C	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10882	10882	\N	\N
5655	hoyt-stanley	Hoyt Stanley	D	297	\N	\N	1075000	2029	3	2005-02-04	\N	6'3	\N	R	204	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11034	11034	\N	\N
5585	colin-ralph	Colin Ralph	D	319	\N	\N	1075000	2029	3	2005-10-04	\N	6'4	\N	L	216	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11055	11055	\N	\N
5775	rieger-lorenz	Rieger Lorenz	L	308	\N	\N	1013750	2028	2	2004-03-30	\N	6'1	\N	L	184	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11085	11085	\N	\N
5519	reece-newkirk	Reece Newkirk	F	320	8481666	\N	828333	2024	0	2001-02-20	Moose Jaw, Saskatchewan, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8481666.png	L	180	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7821	7821	\N	\N
5705	andre-anania	Andre Anania	D	312	\N	\N	\N	\N	\N	2003-03-02	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10888	10888	\N	\N
5419	etienne-morin	Etienne Morin	D	298	8484198	\N	903333	2028	2	2005-03-09	Salaberry-de-Valleyfield, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8484198.png	L	180	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10137	10137	\N	\N
13233	brady-martin	Brady Martin	C	22	\N	\N	975000	2029	3	2007-03-16	\N	6'0	\N	R	185	\N	CAN	https://frozenpool.dobbersports.com/players/brady-martin	\N	\N	\N
13271	hunter-shepard	Hunter Shepard	G	329	8482411	\N	775000	2026	0	1995-11-07	Cohasset, Minnesota, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8482411.png	L	225	\N	USA	https://frozenpool.dobbersports.com/players/hunter-shepard	\N	\N	hunter-shepard
13196	jeff-petry	Jeff Petry	D	329	8473507	\N	775000	2026	0	1987-12-09	Ann Arbor, Michigan, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8473507.png	R	208	D	USA	https://frozenpool.dobbersports.com/players/jeff-petry	\N	\N	jeff-petry
13182	jeff-skinner	Jeff Skinner	LW	329	8475784	\N	3000000	2026	0	1992-05-16	Toronto, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8475784.png	L	200	LW	CAN	https://frozenpool.dobbersports.com/players/jeff-skinner	\N	\N	jeff-skinner
13168	philipp-kurashev	Philipp Kurashev	C	329	8480798	\N	1200000	2026	0	1999-10-12	Munsingen, CHE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8480798.png	L	190	C/LW/RW	CHE	https://frozenpool.dobbersports.com/players/philipp-kurashev	\N	\N	philipp-kurashev
13238	philip-tomasino	Philip Tomasino	C	28	8481577	\N	900000	2027	1	2001-07-28	Mississauga, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8481577.png	R	187	LW/RW	CAN	https://frozenpool.dobbersports.com/players/philip-tomasino	\N	\N	\N
13206	nils-h-glander	Nils H�glander	LW	35	\N	\N	\N	\N	\N	2000-12-20	\N	5'9	\N	L	185	\N	SWE	https://frozenpool.dobbersports.com/players/nils-h-glander	\N	\N	\N
13264	matt-murray	Matt Murray	G	329	8476899	\N	1000000	2026	0	1994-05-25	Thunder Bay, Ontario, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8476899.png	L	220	\N	CAN	https://frozenpool.dobbersports.com/players/matt-murray	\N	\N	matt-murray-1
13350	jeremy-brodeur	JEREMY BRODEUR	G	324	8479609	\N	\N	\N	\N	1996-10-29	Essex Fells, New Jersey, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8479609.png	L	185	\N	USA	https://frozenpool.dobbersports.com/players/jeremy-brodeur	\N	\N	\N
167	ryan-pulock	Ryan Pulock	D	24	8477506	6	6150000	2030	4	1994-10-06	Dauphin, Manitoba, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8477506.png	R	219	D	CAN	\N	\N	\N	\N
349	jake-guentzel	Jake Guentzel	C	32	8477404	59	9000000	2031	5	1994-10-06	Omaha, Nebraska, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8477404.png	L	176	LW	USA	\N	\N	\N	\N
310	ryan-winterton	Ryan Winterton	C	30	8482751	26	1125000	2028	2	2003-09-04	Markham, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8482751.png	R	175	C/RW	CAN	\N	\N	\N	\N
282	adam-gaudette	Adam Gaudette	R	329	8478874	81	2000000	2027	1	1996-10-03	Braintree, Massachusetts, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8478874.png	R	190	RW	USA	\N	\N	\N	adam-gaudette
4971	walker-duehr	Walker Duehr	R	329	8482652	\N	850000	2028	2	1997-11-23	Sioux Falls, South Dakota, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8482652.png	R	210	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8706	8706	\N	walker-duehr
5651	dawson-barteaux	Dawson Barteaux	D	311	8480999	\N	791667	2023	0	2000-01-12	Foxwarren, Manitoba, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8480999.png	R	195	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8454	8454	\N	\N
5322	brandon-scanlin	Brandon Scanlin	D	329	8483407	\N	775000	2026	0	1999-06-02	Hamilton, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8483407.png	L	222	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9048	9048	\N	brandon-scanlin
142	declan-chisholm	Declan Chisholm	D	329	8480990	\N	1600000	2027	1	2000-01-12	Bowmanville, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8480990.png	L	205	D	CAN	\N	\N	\N	declan-chisholm
227	noel-acciari	Noel Acciari	C	329	8478569	\N	2800000	2028	2	1991-12-01	Johnston, Rhode Island, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8478569.png	R	204	C/LW/RW	USA	\N	\N	\N	noel-acciari
5421	jacob-julien	Jacob Julien	C	311	8484430	\N	920000	2028	2	2004-09-12	London, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8484430.png	L	181	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10907	10907	\N	\N
5083	kale-clague	Kale Clague	D	329	8479348	\N	775000	2026	0	1998-06-05	Regina, Saskatchewan, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8479348.png	L	190	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7152	7152	\N	kale-clague
208	ridly-greig	Ridly Greig	C	26	8482092	71	3250000	2029	3	2002-08-08	Lethbridge, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8482092.png	L	184	C/LW	CAN	\N	\N	\N	\N
195	urho-vaakanainen	Urho Vaakanainen	D	329	8480001	18	1550000	2027	1	1999-01-01	Joensuu, FIN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8480001.png	L	202	D	FIN	\N	\N	\N	urho-vaakanainen
99	david-reinbacher	David Reinbacher	D	309	8484220	64	950000	2028	2	2004-10-25	Hohenems, AUT	6'3"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8484220.png	R	207	D	AUT	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10036	10036	\N	\N
177	tye-kartye	Tye Kartye	L	25	8481789	24	1250000	2027	1	2001-04-30	Kingston, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8481789.png	L	202	LW	CAN	\N	\N	\N	\N
5189	scott-harrington	Scott Harrington	D	297	8476449	\N	750000	2023	0	1993-03-10	Kingston, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8476449.png	L	204	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4955	4955	\N	\N
232	christian-dvorak	Christian Dvorak	C	27	8477989	22	5150000	2031	5	1996-02-02	Palos, Illinois, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8477989.png	L	190	C/LW	USA	\N	\N	\N	\N
183	matt-rempe	Matt Rempe	C	25	8482460	73	975000	2027	1	2002-06-29	Calgary, Alberta, CAN	6'9"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8482460.png	R	261	RW	CAN	\N	\N	\N	\N
202	andre-burakovsky	Andre Burakovsky	L	329	8477444	\N	5500000	2027	1	1995-02-09	Klagenfurt, AUT	6'3"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8477444.png	L	203	LW/RW	AUT	\N	\N	\N	andre-burakovsky
223	artem-zub	Artem Zub	D	329	8482245	2	4600000	2027	1	1995-10-03	Khabarovsk, RUS	6'3"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8482245.png	R	201	D	RUS	\N	\N	\N	artem-zub
173	oliver-bjorkstrand	Oliver Bjorkstrand	R	329	8477416	28	4500000	2027	1	1995-04-10	Herning, DNK	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8477416.png	R	175	LW/RW	DNK	\N	\N	\N	oliver-bjorkstrand
160	ondrej-palat	Ondrej Palat	L	329	8476292	81	6000000	2027	1	1991-03-28	Frydek-Mistek, CZE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8476292.png	L	194	LW/RW	CZE	\N	\N	\N	ondrej-palat
172	semyon-varlamov	Semyon Varlamov	G	329	8473575	40	2750000	2027	1	1988-04-27	Samara, RUS	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8473575.png	L	201	\N	RUS	\N	\N	\N	semyon-varlamov
180	jt-miller	J.T. Miller	C	25	8476468	10	\N	\N	\N	1993-03-14	East Palestine, Ohio, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8476468.png	L	211	C/LW/RW	USA	\N	\N	\N	\N
50	bobby-brink	Bobby Brink	R	20	8481553	10	2750000	2027	1	2001-07-08	Minnetonka, Minnesota, USA	5'8"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8481553.png	R	169	RW	USA	\N	\N	\N	\N
96	kaiden-guhle	Kaiden Guhle	D	21	8482087	21	5550000	2031	5	2002-01-18	Edmonton, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8482087.png	L	202	D	CAN	\N	\N	\N	\N
58	michael-mccarron	Michael McCarron	C	20	8477446	47	3333333	2032	6	1995-03-07	Grosse Pointe, Michigan, USA	6'6"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8477446.png	R	232	C/RW	USA	\N	\N	\N	\N
106	mavrik-bourque	Mavrik Bourque	C	22	8482145	\N	5500000	2032	6	2002-01-08	Plessisville, Quebec, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8482145.png	R	187	C/RW	CAN	\N	\N	\N	\N
5	trent-frederic	Trent Frederic	C	1	8479365	10	3850000	2033	7	1998-02-11	St. Louis, Missouri, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8479365.png	L	221	C/LW/RW	USA	\N	\N	\N	\N
44	joel-edmundson	Joel Edmundson	D	329	8476441	6	3850000	2028	2	1993-06-28	Brandon, Manitoba, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8476441.png	L	220	D	CAN	\N	\N	\N	joel-edmundson
13313	luke-cavallin	LUKE CAVALLIN	G	314	8483654	\N	850000	2027	1	2001-04-29	Swindon, GBR	6'1"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8483654.png	R	193	\N	GBR	https://frozenpool.dobbersports.com/players/luke-cavallin	\N	\N	\N
5293	mark-senden	Mark Senden	F	303	8484131	\N	\N	\N	\N	1998-01-22	Medina, Minnesota, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/COL/8484131.png	L	201	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9638	9638	\N	\N
5641	carson-golder	Carson Golder	R	310	8484299	\N	\N	\N	\N	2002-10-29	Smithers, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8484299.png	L	196	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9730	9730	\N	\N
381	nick-paul	Nick Paul	L	2	8477426	\N	\N	\N	\N	1995-03-20	Mississauga, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8477426.png	L	234	C/LW	CAN	\N	\N	\N	\N
5716	brandon-hawkins	Brandon Hawkins	R	304	\N	\N	\N	\N	\N	1994-04-25	\N	5.10	\N	R	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7617	7617	\N	\N
327	connor-mcmichael	Connor McMichael	L	31	8481580	\N	6750000	2032	6	2001-01-15	Ajax, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/STL/8481580.png	L	180	C/LW/RW	CAN	\N	\N	\N	\N
267	rickard-rakell	Rickard Rakell	R	329	8476483	67	5000000	2028	2	1993-05-05	Sundbyberg, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8476483.png	R	194	LW/RW	SWE	\N	\N	\N	rickard-rakell
402	clayton-keller	Clayton Keller	R	329	8479343	9	7150000	2028	2	1998-07-29	Chesterfield, Missouri, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8479343.png	L	175	LW/RW	USA	\N	\N	\N	clayton-keller
321	jonatan-berggren	Jonatan Berggren	R	31	8481013	29	2000000	2027	1	2000-07-16	Uppsala, SWE	5'11"	https://assets.nhle.com/mugs/nhl/20262027/STL/8481013.png	L	195	LW/RW	SWE	\N	\N	\N	\N
276	kris-letang	Kris Letang	D	329	8471724	58	6100000	2028	2	1987-04-24	Montréal, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8471724.png	R	199	D	CAN	\N	\N	\N	kris-letang
252	cam-york	Cam York	D	27	8481546	8	5150000	2030	4	2001-01-05	Anaheim, California, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8481546.png	L	194	D	USA	\N	\N	\N	\N
312	vince-dunn	Vince Dunn	D	329	8478407	29	7350000	2027	1	1996-10-29	Mississauga, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8478407.png	L	200	D	CAN	\N	\N	\N	vince-dunn
319	joey-daccord	Joey Daccord	G	30	8478916	35	5000000	2030	4	1996-08-19	Boston, Massachusetts, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8478916.png	L	201	\N	USA	\N	\N	\N	\N
259	sidney-crosby	Sidney Crosby	C	329	8471675	87	8700000	2027	1	1987-08-07	Cole Harbour, Nova Scotia, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8471675.png	L	200	C	CAN	\N	\N	\N	sidney-crosby
301	berkly-catton	Berkly Catton	C	30	8484800	27	975000	2028	2	2006-01-14	Saskatoon, Saskatchewan, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8484800.png	L	179	C/LW	CAN	\N	\N	\N	\N
288	kiefer-sherwood	Kiefer Sherwood	L	29	8480748	44	5750000	2031	5	1995-03-31	Columbus, Ohio, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8480748.png	R	194	LW/RW	USA	\N	\N	\N	\N
330	jimmy-snuggerud	Jimmy Snuggerud	R	31	8483516	21	950000	2027	1	2004-06-01	Minneapolis, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/STL/8483516.png	R	193	RW	USA	\N	\N	\N	\N
332	pius-suter	Pius Suter	C	329	8480459	22	4125000	2027	1	1996-05-24	Zurich, CHE	5'11"	https://assets.nhle.com/mugs/nhl/20262027/STL/8480459.png	L	172	C/LW/RW	CHE	\N	\N	\N	pius-suter
342	jordan-binnington	Jordan Binnington	G	329	8476412	50	6000000	2027	1	1993-07-11	Richmond Hill, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/STL/8476412.png	L	172	\N	CAN	\N	\N	\N	jordan-binnington
336	philip-broberg	Philip Broberg	D	31	8481598	6	8000000	2032	6	2001-06-25	Orebro, SWE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/STL/8481598.png	L	210	D	SWE	\N	\N	\N	\N
298	eric-comrie	Eric Comrie	G	329	8477480	1	1150000	2028	2	1995-07-06	Edmonton, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8477480.png	L	190	\N	CAN	\N	\N	\N	eric-comrie
284	collin-graf	Collin Graf	R	29	8484911	51	941667	2026	0	2002-09-21	Lincoln, Massachusetts, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8484911.png	R	190	RW	USA	\N	\N	\N	\N
245	jamie-drysdale	Jamie Drysdale	D	27	8482142	9	6500000	2030	4	2002-04-08	Toronto, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8482142.png	R	185	D	CAN	\N	\N	\N	\N
237	travis-konecny	Travis Konecny	R	27	8478439	11	8750000	2033	7	1997-03-11	London, Ontario, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8478439.png	R	192	LW/RW	CAN	\N	\N	\N	\N
255	dan-vladar	Dan Vladar	G	27	8478435	80	5500000	2032	6	1997-08-20	Prague, CZE	6'5"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8478435.png	L	209	\N	CZE	\N	\N	\N	\N
265	evgeni-malkin	Evgeni Malkin	C	329	8471215	71	5500000	2027	1	1986-07-31	Magnitogorsk, RUS	6'5"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8471215.png	L	213	C	RUS	\N	\N	\N	evgeni-malkin
403	anders-lee	Anders Lee	C	329	8475314	\N	5400000	2029	3	1990-07-03	Edina, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8475314.png	L	234	LW	USA	\N	\N	\N	anders-lee
338	cam-fowler	Cam Fowler	D	329	8475764	17	6100000	2029	3	1991-12-05	Windsor, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/STL/8475764.png	L	213	D	CAN	\N	\N	\N	cam-fowler
347	gage-goncalves	Gage Goncalves	C	32	8482201	93	1200000	2027	1	2001-01-16	Mission, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8482201.png	L	189	C	CAN	\N	\N	\N	\N
293	michael-kesselring	Michael Kesselring	D	329	8480891	7	4500000	2029	3	2000-01-13	Florence, South Carolina, USA	6'5"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8480891.png	R	215	D	USA	\N	\N	\N	michael-kesselring
354	nikita-kucherov	Nikita Kucherov	R	329	8476453	86	9500000	2027	1	1993-06-17	Maykop, RUS	6'0"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8476453.png	L	173	RW	RUS	\N	\N	\N	nikita-kucherov
452	brett-howden	Brett Howden	C	36	8479353	21	2500000	2030	4	1998-03-29	Oakbank, Manitoba, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8479353.png	L	201	C/LW/RW	CAN	\N	\N	\N	\N
435	filip-hronek	Filip Hronek	D	35	8479425	17	7250000	2032	6	1997-11-02	Hradec Kralove, CZE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8479425.png	R	190	D	CZE	\N	\N	\N	\N
22	frederik-andersen	Frederik Andersen	G	329	8475883	30	1000000	2027	1	1989-10-02	Herning, DNK	6'4"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8475883.png	L	229	\N	DNK	\N	\N	\N	frederik-andersen
249	rasmus-ristolainen	Rasmus Ristolainen	D	329	8477499	55	5100000	2027	1	1994-10-27	Turku, FIN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8477499.png	R	208	D	FIN	\N	\N	\N	rasmus-ristolainen
361	max-crozier	Max Crozier	D	32	8481719	24	\N	\N	\N	2000-04-19	Calgary, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8481719.png	R	204	D	CAN	\N	\N	\N	\N
366	jj-moser	J.J. Moser	D	32	8482655	90	\N	\N	\N	2000-06-06	Biel, CHE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8482655.png	L	183	D	CHE	\N	\N	\N	\N
554	mark-kastelic	Mark Kastelic	C	329	8480355	47	1566667	2028	2	1999-03-11	Phoenix, Arizona, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8480355.png	R	234	C/RW	USA	\N	\N	\N	mark-kastelic
375	dakota-joshua	Dakota Joshua	C	329	8478057	81	3250000	2028	2	1996-05-15	Dearborn, Michigan, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8478057.png	L	218	C/LW	USA	\N	\N	\N	dakota-joshua
393	sergei-bobrovsky	Sergei Bobrovsky	G	329	8475683	\N	7000000	2029	3	1988-09-20	Novokuznetsk, RUS	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8475683.png	L	180	\N	RUS	\N	\N	\N	sergei-bobrovsky
399	dylan-guenther	Dylan Guenther	R	34	8482699	11	7142857	2033	7	2003-04-10	Edmonton, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8482699.png	R	191	LW/RW	CAN	\N	\N	\N	\N
539	nick-jensen	Nick Jensen	D	329	8475324	\N	2250000	2028	2	1990-09-21	Rogers, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8475324.png	R	202	D	USA	\N	\N	\N	nick-jensen
364	emil-lilleberg	Emil Lilleberg	D	32	8482929	78	825000	2027	1	2001-02-02	Sarpsborg, NOR	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8482929.png	L	215	D	NOR	\N	\N	\N	\N
425	jake-debrusk	Jake DeBrusk	L	35	8478498	74	5500000	2031	5	1996-10-17	Edmonton, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8478498.png	L	198	LW/RW	CAN	\N	\N	\N	\N
369	andrei-vasilevskiy	Andrei Vasilevskiy	G	329	8476883	88	9500000	2028	2	1994-07-25	Tyumen, RUS	6'4"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8476883.png	L	223	\N	RUS	\N	\N	\N	andrei-vasilevskiy
464	noah-hanifin	Noah Hanifin	D	36	8478396	15	7350000	2032	6	1997-01-25	Boston, Massachusetts, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8478396.png	L	206	D	USA	\N	\N	\N	\N
482	aliaksei-protas	Aliaksei Protas	L	329	8481656	21	3375000	2029	3	2001-01-06	Vitebsk, BLR	6'6"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8481656.png	L	250	C/LW	BLR	\N	\N	\N	aliaksei-protas
466	jeremy-lauzon	Jeremy Lauzon	D	36	8478468	5	4000000	2032	6	1997-04-28	Val-d'Or, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8478468.png	L	225	D	CAN	\N	\N	\N	\N
496	charlie-lindgren	Charlie Lindgren	G	329	8479292	79	3000000	2028	2	1993-12-18	Lakeville, Minnesota, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8479292.png	R	190	\N	USA	\N	\N	\N	charlie-lindgren
421	karel-vejmelka	Karel Vejmelka	G	34	8478872	70	4750000	2030	4	1996-05-25	Trebic, CZE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8478872.png	R	221	\N	CZE	\N	\N	\N	\N
419	mackenzie-weegar	MacKenzie Weegar	D	34	8477346	52	6250000	2031	5	1994-01-07	Ottawa, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8477346.png	R	206	D	CAN	\N	\N	\N	\N
370	teddy-blueger	Teddy Blueger	C	329	8476927	\N	2500000	2028	2	1994-08-15	Riga, LVA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8476927.png	L	185	C	LVA	\N	\N	\N	teddy-blueger
594	ryan-johnson	Ryan Johnson	D	329	8481564	33	825000	2028	2	2001-07-24	Newport Beach, California, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8481564.png	L	195	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9767	9767	\N	ryan-johnson
523	cutter-gauthier	Cutter Gauthier	L	7	8483445	61	950000	2026	0	2004-01-19	Skelleftea, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8483445.png	L	205	C/LW	SWE	\N	\N	\N	\N
519	stuart-skinner	Stuart Skinner	G	329	8479973	74	3750000	2028	2	1998-11-01	Edmonton, Alberta, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8479973.png	L	215	\N	CAN	\N	\N	\N	stuart-skinner
378	zack-macewen	Zack MacEwen	C	329	8479772	\N	875000	2028	2	1996-07-08	Charlottetown, Prince Edward Island, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8479772.png	R	226	C/RW	CAN	\N	\N	\N	zack-macewen
501	kyle-connor	Kyle Connor	L	38	8478398	81	12000000	2034	8	1996-12-09	Shelby Township, Michigan, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8478398.png	L	183	LW	USA	\N	\N	\N	\N
582	jiri-kulich	Jiri Kulich	C	9	8483468	20	950000	2027	1	2004-04-14	Kadan, CZE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8483468.png	L	193	C/LW/RW	CZE	\N	\N	\N	\N
531	ryan-poehling	Ryan Poehling	C	7	8480068	25	3750000	2030	4	1999-01-03	Lakeville, Minnesota, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8480068.png	L	206	C/LW	USA	\N	\N	\N	\N
560	david-pastrnak	David Pastrnak	R	3	8477956	88	11250000	2031	5	1996-05-25	Havirov, CZE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8477956.png	R	199	RW	CZE	\N	\N	\N	\N
427	linus-karlsson	Linus Karlsson	C	329	8481024	94	2250000	2028	2	1999-11-16	Landsbro, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8481024.png	R	178	C	SWE	\N	\N	\N	linus-karlsson
548	lukas-dostal	Lukas Dostal	G	7	8480843	1	6500000	2030	4	2000-06-22	Brno, CZE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8480843.png	L	190	\N	CZE	\N	\N	\N	\N
494	matt-roy	Matt Roy	D	37	8478911	3	5750000	2030	4	1995-03-01	Detroit, Michigan, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8478911.png	R	220	D	USA	\N	\N	\N	\N
572	nikita-zadorov	Nikita Zadorov	D	3	8477507	91	5000000	2030	4	1995-04-16	Moscow, RUS	6'7"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8477507.png	L	255	D	RUS	\N	\N	\N	\N
441	thatcher-demko	Thatcher Demko	G	329	8477967	35	8500000	2029	3	1995-12-08	San Diego, California, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8477967.png	L	192	\N	USA	\N	\N	\N	thatcher-demko
507	cole-perfetti	Cole Perfetti	C	38	8482149	91	6000000	2031	5	2002-01-01	Whitby, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8482149.png	L	185	LW/RW	CAN	\N	\N	\N	\N
484	justin-sourdif	Justin Sourdif	C	37	8482088	34	825000	2027	1	2002-03-24	Richmond, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8482088.png	R	195	C/RW	CAN	\N	\N	\N	\N
478	jordan-kyrou	Jordan Kyrou	R	37	8479385	25	8125000	2031	5	1998-05-05	Toronto, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8479385.png	R	189	C/RW	CAN	\N	\N	\N	\N
581	peyton-krebs	Peyton Krebs	C	9	8481522	19	4500000	2030	4	2001-01-26	Calgary, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8481522.png	L	188	C/LW/RW	CAN	\N	\N	\N	\N
651	kandre-miller	K'Andre Miller	D	11	8480817	19	\N	\N	\N	2000-01-21	St. Paul, Minnesota, USA	6'5"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8480817.png	L	210	D	USA	\N	\N	\N	\N
10623	calle-odelius	Calle Odelius	D	326	8483498	\N	870000	2027	1	2004-05-30	Nykvarn, SWE	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8483498.png	L	205	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9953	9953	\N	\N
568	henri-jokiharju	Henri Jokiharju	D	329	8480035	20	3000000	2028	2	1999-06-17	Oulu, FIN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8480035.png	R	205	D	FIN	\N	\N	\N	henri-jokiharju
416	nate-schmidt	Nate Schmidt	D	329	8477220	88	3500000	2028	2	1991-07-16	St. Cloud, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8477220.png	L	197	D	USA	\N	\N	\N	nate-schmidt
683	vinnie-hinostroza	Vinnie Hinostroza	C	329	8476994	\N	875000	2028	2	1994-04-03	Chicago, Illinois, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/COL/8476994.png	R	183	C	USA	\N	\N	\N	vinnie-hinostroza
448	jack-eichel	Jack Eichel	C	36	8478403	9	13500000	2034	8	1996-10-28	North Chelmsford, Massachusetts, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8478403.png	R	208	C	USA	\N	\N	\N	\N
509	mark-scheifele	Mark Scheifele	C	38	8476460	55	8500000	2031	5	1993-03-15	Kitchener, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8476460.png	R	207	C	CAN	\N	\N	\N	\N
551	morgan-geekie	Morgan Geekie	C	3	8479987	39	5500000	2031	5	1998-07-20	Strathclair, Manitoba, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8479987.png	R	212	C/RW	CAN	\N	\N	\N	\N
557	elias-lindholm	Elias Lindholm	C	3	8477496	28	7750000	2031	5	1994-12-02	Boden, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8477496.png	R	200	C	SWE	\N	\N	\N	\N
574	zach-benson	Zach Benson	L	9	8484145	6	7500000	2033	7	2005-05-12	Chilliwack, British Columbia, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8484145.png	L	177	LW/RW	CAN	\N	\N	\N	\N
508	isak-rosen	Isak Rosen	R	315	8482765	27	925000	2028	2	2003-03-15	Solna, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8482765.png	L	185	C/LW/RW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9504	9504	\N	\N
700	josh-manson	Josh Manson	D	329	8476312	42	3950000	2028	2	1991-10-07	Hinsdale, Illinois, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/COL/8476312.png	R	218	D	USA	\N	\N	\N	josh-manson
634	dustin-wolf	Dustin Wolf	G	10	8481692	32	7500000	2033	7	2001-04-16	Gilroy, California, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8481692.png	L	166	\N	USA	\N	\N	\N	\N
138	timo-meier	Timo Meier	R	23	8478414	28	8800000	2031	5	1996-10-08	Herisau, CHE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8478414.png	L	220	LW/RW	CHE	\N	\N	\N	\N
628	simon-nemec	Simon Nemec	D	10	8483495	71	7250000	2031	5	2004-02-15	Liptovský Mikuláš, SVK	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8483495.png	R	190	D	SVK	\N	\N	\N	\N
598	owen-power	Owen Power	D	9	8482671	25	8350000	2031	5	2002-11-22	Mississauga, Ontario, CAN	6'6"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8482671.png	L	226	D	CAN	\N	\N	\N	\N
673	ian-cole	Ian Cole	D	329	8474013	\N	4000000	2027	1	1989-02-21	Ann Arbor, Michigan, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8474013.png	L	237	D	USA	\N	\N	\N	ian-cole
607	matt-coronato	Matt Coronato	R	10	8482679	27	6500000	2032	6	2002-11-14	Greenlawn, New York, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8482679.png	R	183	LW/RW	USA	\N	\N	\N	\N
696	noah-juulsen	Noah Juulsen	D	329	8478454	\N	1100000	2028	2	1997-04-02	Surrey, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/COL/8478454.png	R	201	D	CAN	\N	\N	\N	noah-juulsen
659	sacha-boisvert	Sacha Boisvert	C	12	8484793	12	974167	2028	2	2006-03-17	Trois-Rivières, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8484793.png	L	176	\N	CAN	\N	\N	\N	\N
502	alex-iafallo	Alex Iafallo	L	329	8480113	9	3666667	2028	2	1993-12-21	Eden, New York, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8480113.png	L	201	C/LW	USA	\N	\N	\N	alex-iafallo
692	nicolas-roy	Nicolas Roy	C	329	8478462	10	3000000	2027	1	1997-02-05	Amos, Quebec, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/COL/8478462.png	R	200	C/RW	CAN	\N	\N	\N	nicolas-roy
680	spencer-knight	Spencer Knight	G	329	8481519	30	5833333	2029	3	2001-04-19	Darien, Connecticut, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8481519.png	L	191	\N	USA	\N	\N	\N	spencer-knight
45	erik-gustafsson	Erik Gustafsson	D	329	8476979	\N	1000000	2027	1	1992-03-14	Nynashamn, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/DET/8476979.png	L	190	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6103	6103	\N	erik-gustafsson
657	connor-bedard	Connor Bedard	C	12	8484144	98	15000000	2031	5	2005-07-17	North Vancouver, British Columbia, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8484144.png	R	190	C	CAN	\N	\N	\N	\N
633	devin-cooley	Devin Cooley	G	329	8482445	1	1350000	2028	2	1997-05-25	Los Gatos, California, USA	6'5"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8482445.png	L	192	\N	USA	\N	\N	\N	devin-cooley
653	jaccob-slavin	Jaccob Slavin	D	11	8476958	74	6395955	2033	7	1994-05-01	Denver, Colorado, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8476958.png	L	207	D	USA	\N	\N	\N	\N
605	matt-villalta	Matt Villalta	G	329	8480191	\N	850000	2027	1	1999-06-03	Kingston, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8480191.png	L	190	\N	CAN	\N	\N	\N	matt-villalta
644	jordan-martinook	Jordan Martinook	L	329	8476921	48	3075000	2027	1	1992-07-25	Brandon, Manitoba, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8476921.png	L	208	C/LW/RW	CAN	\N	\N	\N	jordan-martinook
616	adam-klapka	Adam Klapka	R	10	8483609	43	1250000	2027	1	2000-09-14	Praha, CZE	6'8"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8483609.png	R	235	LW/RW	CZE	\N	\N	\N	\N
677	artyom-levshunov	Artyom Levshunov	D	12	8484783	55	975000	2027	1	2005-10-28	Zhlobin, BLR	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8484783.png	R	208	D	BLR	\N	\N	\N	\N
602	colten-ellis	Colten Ellis	G	9	8481551	92	812500	2027	1	2000-10-05	Whycocomagh, Nova Scotia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8481551.png	L	191	\N	CAN	\N	\N	\N	\N
670	teuvo-teravainen	Teuvo Teravainen	C	329	8476882	86	5400000	2027	1	1994-09-11	Helsinki, FIN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8476882.png	L	191	LW/RW	FIN	\N	\N	\N	teuvo-teravainen
689	martin-necas	Martin Necas	C	13	8480039	88	11500000	2034	8	1999-01-15	Nove Mesto na Morave, CZE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/COL/8480039.png	R	195	C/RW	CZE	\N	\N	\N	\N
809	uvis-balinskis	Uvis Balinskis	D	329	8484304	26	875000	2028	2	1996-08-01	Ventspils, LVA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8484304.png	L	196	D	LVA	\N	\N	\N	uvis-balinskis
639	nikolaj-ehlers	Nikolaj Ehlers	L	11	8477940	27	8500000	2031	5	1996-02-14	Aalborg, DNK	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8477940.png	L	168	LW/RW	DNK	\N	\N	\N	\N
716	miles-wood	Miles Wood	L	329	8477425	11	2500000	2029	3	1995-09-13	Buffalo, New York, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8477425.png	L	209	LW	USA	\N	\N	\N	miles-wood
231	sean-couturier	Sean Couturier	C	27	8476461	14	7750000	2030	4	1992-12-07	Phoenix, Arizona, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8476461.png	L	210	C	USA	\N	\N	\N	\N
2	colton-dach	Colton Dach	C	1	8482703	34	1200000	2028	2	2003-01-04	St. Albert, Alberta, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8482703.png	L	218	C/LW	CAN	\N	\N	\N	\N
640	taylor-hall	Taylor Hall	L	329	8475791	71	3166667	2028	2	1991-11-14	Calgary, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8475791.png	L	210	LW	CAN	\N	\N	\N	taylor-hall
739	sam-steel	Sam Steel	C	329	8479351	18	2100000	2027	1	1998-02-03	Ardrossan, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8479351.png	L	185	C/LW	CAN	\N	\N	\N	sam-steel
800	anton-lundell	Anton Lundell	C	18	8482113	15	5000000	2030	4	2001-10-03	Espoo, FIN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8482113.png	L	196	C	FIN	\N	\N	\N	\N
707	kent-johnson	Kent Johnson	C	14	8482660	91	1800000	2027	1	2002-10-18	Port Moody, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8482660.png	L	170	C/LW/RW	CAN	\N	\N	\N	\N
228	denver-barkey	Denver Barkey	F	310	8484142	52	913333	2028	2	2005-04-27	Newmarket, Ontario, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8484142.png	L	171	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10720	10720	\N	\N
805	cole-schwindt	Cole Schwindt	C	329	8481655	79	875000	2028	2	2001-04-25	Kitchener, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8481655.png	R	210	RW	CAN	\N	\N	\N	cole-schwindt
532	beckett-sennecke	Beckett Sennecke	R	7	8484762	45	975000	2028	2	2006-01-28	Toronto, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8484762.png	R	206	RW	CAN	\N	\N	\N	\N
794	john-beecher	John Beecher	C	18	8481556	17	850000	2027	1	2001-04-05	Elmira, New York, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8481556.png	L	220	C	USA	\N	\N	\N	\N
241	owen-tippett	Owen Tippett	R	27	8480015	74	6200000	2032	6	1999-02-16	Peterborough, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8480015.png	R	210	LW/RW	CAN	\N	\N	\N	\N
759	lucas-raymond	Lucas Raymond	L	16	8482078	23	8075000	2032	6	2002-03-28	Gothenburg, SWE	5'11"	https://assets.nhle.com/mugs/nhl/20262027/DET/8482078.png	R	186	LW	SWE	\N	\N	\N	\N
797	jonah-gadjovich	Jonah Gadjovich	L	329	8479981	12	905000	2028	2	1998-10-12	Whitby, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8479981.png	L	211	LW	CAN	\N	\N	\N	jonah-gadjovich
803	cole-reinhardt	Cole Reinhardt	L	329	8481133	29	812500	2027	1	2000-02-01	Calgary, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8481133.png	L	207	LW	CAN	\N	\N	\N	cole-reinhardt
755	marco-kasper	Marco Kasper	C	16	8483464	92	950000	2027	1	2004-04-08	Innsbruck, AUT	6'1"	https://assets.nhle.com/mugs/nhl/20262027/DET/8483464.png	L	202	C/LW	AUT	\N	\N	\N	\N
819	akira-schmid	Akira Schmid	G	18	8481033	40	875000	2026	0	2000-05-12	Bern, CHE	6'5"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8481033.png	L	190	\N	CHE	\N	\N	\N	\N
750	viktor-arvidsson	Viktor Arvidsson	L	329	8478042	\N	5000000	2028	2	1993-04-08	Skelleftea, SWE	5'10"	https://assets.nhle.com/mugs/nhl/20262027/DET/8478042.png	R	181	LW/RW	SWE	\N	\N	\N	viktor-arvidsson
815	niko-mikkola	Niko Mikkola	D	18	8478859	77	5000000	2034	8	1996-04-27	Kiiminki, FIN	6'6"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8478859.png	L	204	D	FIN	\N	\N	\N	\N
277	trevor-van-riemsdyk	Trevor van Riemsdyk	D	329	8477845	\N	4000000	2028	2	1991-07-24	Middletown, New Jersey, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8477845.png	R	210	D	USA	\N	\N	\N	trevor-van-riemsdyk
751	jt-compher	J.T. Compher	L	329	8477456	37	\N	\N	\N	1995-04-08	Northbrook, Illinois, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/DET/8477456.png	R	191	C/LW/RW	USA	\N	\N	\N	j-t-compher
715	dmitri-voronkov	Dmitri Voronkov	L	14	8481716	10	4175000	2027	1	2000-09-10	Angarsk, RUS	6'5"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8481716.png	L	234	LW	RUS	\N	\N	\N	\N
765	albert-johansson	Albert Johansson	D	16	8481607	20	1125000	2027	1	2001-01-04	Karlstad, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/DET/8481607.png	L	195	D	SWE	\N	\N	\N	\N
793	aleksander-barkov	Aleksander Barkov	C	18	8477493	16	10000000	2030	4	1995-09-02	Tampere, FIN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8477493.png	L	214	\N	FIN	\N	\N	\N	\N
745	nils-lundkvist	Nils Lundkvist	D	329	8480878	5	1750000	2028	2	2000-07-27	Pitea, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8480878.png	R	194	D	SWE	\N	\N	\N	nils-lundkvist
731	roope-hintz	Roope Hintz	C	15	8478449	24	8450000	2031	5	1996-11-17	Nokia, FIN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8478449.png	L	217	C/LW	FIN	\N	\N	\N	\N
721	ivan-provorov	Ivan Provorov	D	14	8478500	9	8500000	2032	6	1997-01-13	Yaroslavl, RUS	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8478500.png	L	224	D	RUS	\N	\N	\N	\N
812	radko-gudas	Radko Gudas	D	18	8475462	6	1500000	2032	6	1990-06-05	Prague, CZE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8475462.png	R	208	D	CZE	\N	\N	\N	\N
795	sam-bennett	Sam Bennett	C	18	8477935	9	8000000	2033	7	1996-06-20	Holland Landing, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8477935.png	L	193	C/LW	CAN	\N	\N	\N	\N
70	carson-lambos	Carson Lambos	D	308	8482781	28	850000	2027	1	2003-01-14	Winnipeg, Manitoba, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8482781.png	L	197	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9856	9856	\N	\N
585	josh-norris	Josh Norris	C	9	8480064	9	7950000	2030	4	1999-05-05	Oxford, Michigan, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8480064.png	L	196	C/LW	USA	\N	\N	\N	\N
450	tomas-hertl	Tomas Hertl	C	36	8476881	48	8137500	2030	4	1993-11-12	Praha, CZE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8476881.png	L	220	C/LW	CZE	\N	\N	\N	\N
764	justin-faulk	Justin Faulk	D	329	8475753	72	6500000	2027	1	1992-03-20	South St. Paul, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/DET/8475753.png	R	208	D	USA	\N	\N	\N	justin-faulk
5141	matt-strome	Matt Strome	C	307	\N	\N	\N	\N	\N	1999-01-06	\N	6.04	\N	L	206	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7584	7584	\N	\N
709	isac-lundestrm	Isac Lundeström	C	14	8480806	21	\N	\N	\N	1999-11-06	Gallivare, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8480806.png	L	192	C/RW	SWE	\N	\N	\N	\N
13158	martin-feh-rv-ry	Martin Feh�rv�ry	D	37	\N	\N	\N	\N	\N	1999-10-06	\N	6'2	\N	L	215	\N	SVK	https://frozenpool.dobbersports.com/players/martin-feh-rv-ry	\N	\N	\N
401	cam-hebig	Cam Hebig	C	34	8479656	78	\N	\N	\N	1997-01-21	Saskatoon, Saskatchewan, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8479656.png	R	184	RW	CAN	\N	\N	\N	\N
806	brady-tkachuk	Brady Tkachuk	L	329	8480801	8	8330674	2028	2	1999-09-16	Scottsdale, Arizona, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8480801.png	L	226	LW	USA	\N	\N	\N	brady-tkachuk
723	zach-werenski	Zach Werenski	D	329	8478460	8	9583333	2028	2	1997-07-19	Grosse Pointe, Michigan, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8478460.png	L	214	D	USA	\N	\N	\N	zach-werenski
10	kasperi-kapanen	Kasperi Kapanen	R	329	8477953	42	2600000	2027	1	1996-07-23	Kuopio, FIN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8477953.png	R	194	LW/RW	FIN	\N	\N	\N	kasperi-kapanen
576	justin-danforth	Justin Danforth	R	329	8479941	15	1800000	2027	1	1993-03-15	Oshawa, Ontario, CAN	5'8"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8479941.png	R	193	C/RW	CAN	\N	\N	\N	justin-danforth
163	tony-deangelo	Tony DeAngelo	D	329	8477950	77	4500000	2028	2	1995-10-24	Sewell, New Jersey, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8477950.png	R	190	D	USA	\N	\N	\N	tony-deangelo
742	thomas-harley	Thomas Harley	D	15	8481581	55	10587000	2034	8	2001-08-19	Syracuse, New York, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8481581.png	L	214	D	USA	\N	\N	\N	\N
120	justin-barron	Justin Barron	D	22	8482111	20	1575000	2027	1	2001-11-15	Halifax, Nova Scotia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8482111.png	R	198	D	CAN	\N	\N	\N	\N
681	arvid-soderblom	Arvid Soderblom	G	329	8482821	40	2750000	2027	1	1999-08-19	Göteborg, SWE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8482821.png	L	180	\N	SWE	\N	\N	\N	arvid-soderblom
25	joel-armia	Joel Armia	R	329	8476469	40	2500000	2027	1	1993-05-31	Pori, FIN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8476469.png	R	215	RW	FIN	\N	\N	\N	joel-armia
109	adam-edstrom	Adam Edstrom	C	22	8481726	\N	975000	2027	1	2000-10-12	Karlstad, SWE	6'7"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8481726.png	L	232	C	SWE	\N	\N	\N	\N
486	alex-tuch	Alex Tuch	R	37	8477949	89	10500000	2034	8	1996-05-10	Syracuse, New York, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8477949.png	R	219	RW	USA	\N	\N	\N	\N
372	brandon-duhaime	Brandon Duhaime	R	329	8479520	\N	2600000	2029	3	1997-05-22	Coral Springs, Florida, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8479520.png	L	210	LW/RW	USA	\N	\N	\N	brandon-duhaime
4867	tristen-nielsen	Tristen Nielsen	F	329	8483039	\N	812500	2027	1	2000-02-23	Fort St. John, British Columbia, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/COL/8483039.png	L	192	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8929	8929	\N	tristen-nielsen
555	marat-khusnutdinov	Marat Khusnutdinov	C	3	8482177	92	925000	2027	1	2002-07-17	Moscow, RUS	5'11"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8482177.png	L	184	C	RUS	\N	\N	\N	\N
75	riley-mercer	Riley Mercer	G	20	8483918	50	869167	2028	2	2004-03-31	Bay Roberts, Newfoundland and Labrador, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8483918.png	L	200	\N	CAN	\N	\N	\N	\N
40	cody-ceci	Cody Ceci	D	329	8476879	5	4500000	2029	3	1993-12-21	Ottawa, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8476879.png	R	210	D	CAN	\N	\N	\N	cody-ceci
520	leo-carlsson	Leo Carlsson	C	7	8484153	91	18000000	2031	5	2004-12-26	Karlstad, SWE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8484153.png	L	208	C/RW	SWE	\N	\N	\N	\N
140	stefan-noesen	Stefan Noesen	R	329	8476474	11	2750000	2027	1	1993-02-12	Plano, Texas, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8476474.png	R	205	RW	USA	\N	\N	\N	stefan-noesen
5153	noel-nordh	Noel Nordh	F	323	8484207	\N	865000	2028	2	2005-01-25	Soderhamn, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8484207.png	L	196	LW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10214	10214	\N	\N
196	dylan-garand	Dylan Garand	G	25	8482193	33	875000	2028	2	2002-06-07	Victoria, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8482193.png	L	185	\N	CAN	\N	\N	\N	\N
611	tyson-gross	Tyson Gross	C	10	8486056	39	975000	2027	1	2002-09-23	Calgary, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8486056.png	R	195	C	CAN	\N	\N	\N	\N
408	kevin-stenlund	Kevin Stenlund	C	329	8478831	82	2750000	2027	1	1996-09-20	Stockholm, SWE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8478831.png	R	213	C	SWE	\N	\N	\N	kevin-stenlund
394	anthony-stolarz	Anthony Stolarz	G	2	8476932	41	3750000	2030	4	1994-01-20	Edison, New Jersey, USA	6'6"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8476932.png	L	248	\N	USA	\N	\N	\N	\N
101	maksymilian-szuber	Maksymilian Szuber	D	21	8483763	\N	859167	2026	0	2002-08-25	Opole, POL	6'3"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8483763.png	L	215	D	POL	\N	\N	\N	\N
756	keegan-kolesar	Keegan Kolesar	R	329	8478434	\N	2500000	2028	2	1997-04-08	Brandon, Manitoba, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/DET/8478434.png	R	216	RW	CAN	\N	\N	\N	keegan-kolesar
522	nathan-gaucher	Nathan Gaucher	C	317	8483444	41	950000	2027	1	2003-11-06	Chambly, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8483444.png	R	226	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9185	9185	\N	\N
695	brent-burns	Brent Burns	D	329	8470613	84	850000	2027	1	1985-03-09	Barrie, Ontario, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/COL/8470613.png	R	228	D	CAN	\N	\N	\N	brent-burns
3	jason-dickinson	Jason Dickinson	C	1	8477450	16	4000000	2031	5	1995-07-04	Georgetown, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8477450.png	L	200	C/LW	CAN	\N	\N	\N	\N
4805	justin-robidas	Justin Robidas	F	300	8482785	\N	825000	2026	0	2003-03-13	Plano, Texas, USA	5'8"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8482785.png	R	176	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10469	10469	\N	\N
13164	fr-d-rick-gaudreau	Fr�d�rick Gaudreau	C	30	\N	\N	\N	\N	\N	1993-05-01	\N	6'0	\N	R	184	\N	CAN	https://frozenpool.dobbersports.com/players/fr-d-rick-gaudreau	\N	\N	\N
4950	evan-vierling	Evan Vierling	F	300	8482152	\N	\N	\N	\N	2002-06-20	Aurora, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8482152.png	L	167	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9807	9807	\N	\N
4899	gerry-mayhew	Gerry Mayhew	C	308	8479933	\N	\N	\N	\N	1992-12-31	Wyandotte, Michigan, USA	5'9"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8479933.png	R	161	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6616	6616	\N	\N
5324	brendan-warren	Brendan Warren	R	315	8478429	\N	\N	\N	\N	1997-05-07	Carleton, Michigan, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8478429.png	L	191	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8705	8705	\N	\N
4834	logan-shaw	Logan Shaw	F	322	8476400	\N	725000	2022	0	1992-10-05	Glace Bay, Nova Scotia, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8476400.png	R	208	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4573	4573	\N	\N
4845	matthew-seminoff	Matthew Seminoff	F	321	8483514	\N	875000	2028	2	2003-12-27	Leesburg, Virginia, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8483514.png	R	189	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9961	9961	\N	\N
615	rory-kerins	Rory Kerins	C	298	8482209	6	850000	2027	1	2002-04-12	Caledon, Ontario, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8482209.png	L	175	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8617	8617	\N	\N
80	owen-beck	Owen Beck	F	309	8483424	62	916667	2027	1	2004-02-03	Port Hope, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8483424.png	R	199	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10367	10367	\N	\N
412	nick-desimone	Nick DeSimone	D	329	8480084	57	1000000	2028	2	1994-11-21	East Amherst, New York, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8480084.png	R	194	D	USA	\N	\N	\N	nick-desimone
4848	glenn-gawdin	Glenn Gawdin	F	329	8478446	\N	875000	2028	2	1997-03-25	Richmond, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8478446.png	R	195	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6784	6784	\N	glenn-gawdin
146	johnathan-kovacevic	Johnathan Kovacevic	D	23	8480192	8	4000000	2030	4	1997-07-12	Hamilton, Ontario, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8480192.png	R	223	D	CAN	\N	\N	\N	\N
4856	matthew-peca	Matthew Peca	C	320	8476285	\N	762500	2024	0	1993-04-27	Petawawa, Ontario, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8476285.png	L	181	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5896	5896	\N	\N
818	jacob-markstrom	Jacob Markstrom	G	329	8474593	25	6000000	2028	2	1990-01-31	Gavle, SWE	6'6"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8474593.png	L	207	\N	SWE	\N	\N	\N	jacob-markstrom
4858	ryan-carpenter	Ryan Carpenter	C	317	8477846	\N	775000	2024	0	1991-01-18	Oviedo, Florida, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8477846.png	R	198	C/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5461	5461	\N	\N
238	jett-luchanko	Jett Luchanko	C	27	8484779	17	975000	2029	3	2006-08-21	London, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8484779.png	R	180	\N	CAN	\N	\N	\N	\N
5143	will-butcher	Will Butcher	D	301	\N	\N	775000	2024	0	1995-01-06	\N	5.10	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9532	9532	\N	\N
4816	logan-morrison	Logan Morrison	F	302	8483012	\N	850000	2027	1	2002-07-09	Guelph, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8483012.png	R	180	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9756	9756	\N	\N
4904	nils-aman	Nils Aman	C	329	8482496	\N	825000	2026	0	2000-02-07	Avesta, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8482496.png	L	179	C	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9406	9406	\N	nils-aman
4809	zac-jones	Zac Jones	D	329	8481708	\N	875000	2028	2	2000-10-18	Richmond, Virginia, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8481708.png	L	190	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8864	8864	\N	zac-jones
703	scott-wedgewood	Scott Wedgewood	G	329	8475809	41	2500000	2027	1	1992-08-14	Brampton, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/COL/8475809.png	L	201	\N	CAN	\N	\N	\N	scott-wedgewood
4869	lukas-cormier	Lukas Cormier	D	306	8482141	\N	850000	2027	1	2002-03-27	Sainte-Marie-de-Kent, New Brunswick, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8482141.png	L	184	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9278	9278	\N	\N
4849	isaac-howard	Isaac Howard	L	296	8483455	\N	950000	2028	2	2004-03-30	Hudson, Wisconsin, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8483455.png	L	180	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10933	10933	\N	\N
4825	austin-poganski	Austin Poganski	R	323	8478040	\N	750000	2023	0	1996-02-16	St. Cloud, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8478040.png	R	206	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7069	7069	\N	\N
210	hayden-hodgson	Hayden Hodgson	R	329	8478173	42	812500	2027	1	1996-03-02	Windsor, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8478173.png	R	226	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6653	6653	\N	hayden-hodgson
4898	fabian-lysell	Fabian Lysell	R	314	8482763	\N	850000	2027	1	2003-01-19	Gothenburg, SWE	5'11"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8482763.png	R	186	RW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9524	9524	\N	\N
4909	kenny-connors	Kenny Connors	F	313	8483675	\N	905000	2027	1	2003-03-10	Glen Mills, Pennsylvania, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8483675.png	L	199	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10705	10705	\N	\N
4878	jack-devine	Jack Devine	F	299	8483433	\N	950000	2028	2	2003-10-01	Glencoe, Illinois, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8483433.png	R	173	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10615	10615	\N	\N
5626	viggo-gustafsson	Viggo Gustafsson	D	312	\N	\N	990000	2029	3	2006-09-11	\N	6'3	\N	L	196	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11024	11024	\N	\N
423	filip-chytil	Filip Chytil	C	329	8480078	72	4437500	2027	1	1999-09-05	Kromeriz, CZE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8480078.png	L	210	C/RW	CZE	\N	\N	\N	filip-chytil
4984	matteo-pietroniro	Matteo Pietroniro	D	320	8483078	\N	\N	\N	\N	1998-10-20	Boise, Idaho, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8483078.png	L	185	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8884	8884	\N	\N
4901	jack-becker	Jack Becker	F	321	8478912	\N	\N	\N	\N	1997-06-24	Duluth, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8478912.png	R	191	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9456	9456	\N	\N
4957	kyle-criscuolo	Kyle Criscuolo	C	324	8479304	\N	\N	\N	\N	1992-05-05	Southampton, New Jersey, USA	5'9"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8479304.png	R	175	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6262	6262	\N	\N
13169	max-shabanov	Max Shabanov	F	24	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	RW	\N	https://frozenpool.dobbersports.com/players/max-shabanov	\N	\N	\N
4923	mitch-mclain	Mitch Mclain	F	306	8480750	\N	\N	\N	\N	1993-12-09	Baxter, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8480750.png	L	196	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7028	7028	\N	\N
4998	michael-benning	Michael Benning	D	299	\N	\N	\N	\N	\N	2002-01-05	\N	5.09	\N	R	177	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9988	9988	\N	\N
13172	jacob-middleton	Jacob Middleton	D	20	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	D	\N	https://frozenpool.dobbersports.com/players/jacob-middleton	\N	\N	\N
5030	michael-karow	Michael Karow	D	321	8480211	\N	\N	\N	\N	1998-12-18	Green Bay, Wisconsin, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8480211.png	L	200	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9075	9075	\N	\N
5097	j-r-avon	J.r. Avon	F	302	\N	\N	\N	\N	\N	2003-07-04	\N	6.00	\N	L	174	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9992	9992	\N	\N
5090	alex-suzdalev	Alex Suzdalev	R	307	\N	\N	\N	\N	\N	2004-03-05	\N	6.02	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9734	9734	\N	\N
5784	sam-stevens	Sam Stevens	C	322	8484942	\N	\N	\N	\N	2000-04-27	Montréal, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8484942.png	L	183	C/LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10160	10160	\N	\N
5068	roland-mckeown	Roland Mckeown	D	317	8477981	\N	\N	\N	\N	1996-01-20	Listowel, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8477981.png	R	195	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5912	5912	\N	\N
4989	calen-addison	Calen Addison	D	329	8480884	\N	775000	2026	0	2000-04-11	Brandon, Manitoba, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8480884.png	R	173	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7624	7624	\N	calen-addison
4935	wilmer-skoog	Wilmer Skoog	F	329	8484380	\N	850000	2027	1	1999-07-17	Stockholm, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8484380.png	L	196	C	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9990	9990	\N	wilmer-skoog
5046	tucker-robertson	Tucker Robertson	F	329	8483043	\N	870000	2026	0	2003-06-22	Toronto, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8483043.png	R	188	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9768	9768	\N	tucker-robertson
5052	chase-wouters	Chase Wouters	C	329	8481163	\N	850000	2027	1	2000-02-08	North Battleford, Saskatchewan, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8481163.png	R	182	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7696	7696	\N	chase-wouters
357	scott-sabourin	Scott Sabourin	R	329	8477149	46	850000	2027	1	1992-07-30	Orleans, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8477149.png	R	205	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4910	4910	\N	scott-sabourin
4880	luca-pinelli	Luca Pinelli	L	301	8484214	\N	878333	2028	2	2005-04-05	Stoney Creek, Ontario, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8484214.png	L	176	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10176	10176	\N	\N
5156	sawyer-mynio	Sawyer Mynio	D	295	8484202	\N	870000	2028	2	2005-04-30	Kamloops, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8484202.png	L	173	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10077	10077	\N	\N
4943	domenick-fensore	Domenick Fensore	D	300	8481562	\N	850000	2027	1	2001-09-07	Thornwood, New York, USA	5'9"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8481562.png	L	175	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10001	10001	\N	\N
4982	gustav-olofsson	Gustav Olofsson	D	329	8477467	\N	775000	2026	0	1994-12-01	Boras, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8477467.png	L	199	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5471	5471	\N	gustav-olofsson
4953	jacob-quillan	Jacob Quillan	C	322	8484901	\N	850000	2027	1	2002-02-02	Dartmouth, Nova Scotia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8484901.png	L	204	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10091	10091	\N	\N
4929	dillon-dube	Dillon Dube	L	329	\N	\N	850000	2027	1	1998-07-20	\N	5'11	\N	L	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6786	6786	\N	dillon-dube
5077	hunter-mckown	Hunter Mckown	C	301	8484125	\N	800000	2026	0	2002-08-18	San Jose, California, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8484125.png	R	192	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9980	9980	\N	\N
5048	zayde-wisdom	Zayde Wisdom	C	310	8482161	\N	825833	2025	0	2002-07-07	Toronto, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8482161.png	R	195	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8451	8451	\N	\N
5041	lucas-mercuri	Lucas Mercuri	C	320	8482518	\N	905000	2027	1	2002-03-07	Montréal, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8482518.png	R	222	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10566	10566	\N	\N
4991	christian-wolanin	Christian Wolanin	D	329	8478846	\N	850000	2027	1	1995-03-17	Quebec City, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8478846.png	L	190	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7378	7378	\N	christian-wolanin
5022	sammy-walker	Sammy Walker	F	323	\N	\N	775000	2025	0	1999-06-07	\N	5'10	\N	R	180	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9396	9396	\N	\N
5110	viktor-neuchev	Viktor Neuchev	R	300	8483496	\N	850000	2027	1	2003-10-25	Chelyabinsk, RUS	5'11"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8483496.png	L	180	LW	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9927	9927	\N	\N
5059	jonas-r-ndbjerg	JONAS RøNDBJERG	F	306	\N	\N	\N	\N	\N	1999-03-31	\N	6'2	\N	L	206	\N	DNK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7760	7760	\N	\N
5066	max-szuber	Max Szuber	D	323	\N	\N	\N	\N	\N	2002-08-25	\N	6.03	\N	L	220	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9217	9217	\N	\N
5169	ty-gallagher	Ty Gallagher	D	314	8482719	\N	\N	\N	\N	2003-03-06	Clarkston, Michigan, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8482719.png	R	188	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10508	10508	\N	\N
5128	ty-tullio	Ty Tullio	R	323	\N	\N	\N	\N	\N	2002-04-05	\N	6.00	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8631	8631	\N	\N
13270	arsenii-sergeev	Arsenii Sergeev	G	10	8482949	\N	903750	2027	1	2002-12-16	Yaroslavl, RUS	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8482949.png	L	192	\N	RUS	https://frozenpool.dobbersports.com/players/arsenii-sergeev	\N	\N	\N
5025	yegor-sidorov	Yegor Sidorov	R	317	8484396	\N	890000	2027	1	2004-06-18	Vitebsk, BLR	6'0"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8484396.png	L	184	LW/RW	BLR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10274	10274	\N	\N
5219	michal-kunc	Michal Kunc	F	329	8485527	\N	861000	2026	0	2000-10-31	Brno, CZE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8485527.png	L	187	LW	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10668	10668	\N	michal-kunc
5104	nikolas-brouillard	Nikolas Brouillard	D	317	8477522	\N	775000	2025	0	1995-02-07	St-Hyacinthe, Quebec, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8477522.png	L	172	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6442	6442	\N	\N
5034	ryan-schmelzer	Ryan Schmelzer	C	329	8481115	\N	775000	2026	0	1993-07-28	Buffalo, New York, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8481115.png	R	188	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7251	7251	\N	ryan-schmelzer
5070	trey-taylor	Trey Taylor	D	321	8485468	\N	975000	2027	1	2002-02-04	Richmond, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8485468.png	L	196	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10535	10535	\N	\N
5074	borya-valis	Borya Valis	F	322	\N	\N	922500	2028	2	2004-04-08	\N	6'2	\N	R	195	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10613	10613	\N	\N
5079	jared-davidson	Jared Davidson	F	309	8483728	\N	862500	2026	0	2002-07-07	Edmonton, Alberta, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8483728.png	L	183	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9796	9796	\N	\N
5001	samuel-bolduc	Samuel Bolduc	D	297	8481541	\N	850000	2027	1	2000-12-09	Laval, Quebec, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8481541.png	L	224	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7822	7822	\N	\N
5227	anton-blidh	Anton Blidh	F	329	8477320	\N	812500	2027	1	1995-03-14	Molnlycke, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8477320.png	L	191	LW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5995	5995	\N	anton-blidh
5032	ondrej-becher	Ondrej Becher	C	304	8484836	\N	890000	2027	1	2004-02-22	Ostrava, CZE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/DET/8484836.png	L	198	C/LW/RW	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10479	10479	\N	\N
5131	akil-thomas	Akil Thomas	F	329	8480851	\N	900000	2027	1	2000-01-02	Toronto, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/STL/8480851.png	R	195	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7682	7682	\N	akil-thomas
5177	gabriel-szturc	Gabriel Szturc	C	320	8484507	\N	895000	2027	1	2003-09-24	Cesky Tesin, CZE	5'11"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8484507.png	L	191	C/LW	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9901	9901	\N	\N
5216	jan-jenik	Jan Jenik	F	313	8480890	\N	850000	2027	1	2000-09-15	Nymburk, CZE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8480890.png	L	204	RW	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7713	7713	\N	\N
5222	noah-philp	Noah Philp	C	329	8481491	\N	775000	2026	0	1998-08-31	Canmore, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8481491.png	R	198	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7605	7605	\N	noah-philp
5231	colby-barlow	Colby Barlow	R	311	8484143	\N	950000	2028	2	2005-02-14	Orillia, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8484143.png	L	190	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10121	10121	\N	\N
5224	robbie-russo	Robbie Russo	D	323	8476418	\N	750000	2023	0	1993-02-15	Westmont, Illinois, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8476418.png	R	190	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6037	6037	\N	\N
5191	cal-foote	Cal Foote	D	300	\N	\N	800000	2024	0	1998-12-13	\N	6'5	\N	R	224	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7089	7089	\N	\N
5164	kirill-kudryavtsev	Kirill Kudryavtsev	D	295	8483467	\N	850000	2027	1	2004-02-05	Yaroslavl, RUS	5'11"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8483467.png	L	200	D	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10452	10452	\N	\N
5086	nick-cicek	Nick Cicek	D	329	8482824	\N	775000	2026	0	2000-05-29	Winnipeg, Manitoba, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8482824.png	L	201	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8741	8741	\N	nick-cicek
5154	nolan-allan	Nolan Allan	D	318	8482700	\N	875000	2028	2	2003-04-28	Saskatoon, Saskatchewan, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8482700.png	L	195	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9153	9153	\N	\N
5142	ronan-seeley	Ronan Seeley	D	300	8482187	\N	813750	2026	0	2002-08-02	Yellowknife, Northwest Territories, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8482187.png	L	201	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9168	9168	\N	\N
5199	james-malatesta	James Malatesta	L	301	8482744	\N	850000	2027	1	2003-05-31	Montréal, Quebec, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8482744.png	L	193	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9978	9978	\N	\N
5099	john-hayden	John Hayden	F	329	8477401	\N	812500	2027	1	1995-02-14	Chicago, Illinois, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8477401.png	R	223	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6956	6956	\N	john-hayden
13178	ond-ej-pal-t	Ond?ej Pal�t	LW	23	\N	\N	\N	\N	\N	1991-03-28	\N	6'0	\N	L	194	\N	CZE	https://frozenpool.dobbersports.com/players/ond-ej-pal-t	\N	\N	\N
5323	brendan-hoffmann	Brendan Hoffmann	F	318	8485718	\N	\N	\N	\N	2001-10-09	Charlotte, North Carolina, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8485718.png	R	230	C/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10964	10964	\N	\N
5321	bennett-schimek	Bennett Schimek	R	295	\N	\N	\N	\N	\N	2003-04-15	\N	6.00	\N	R	192	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10974	10974	\N	\N
5351	david-silye	David Silye	C	298	8484919	\N	\N	\N	\N	1999-03-02	Arnprior, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8484919.png	R	187	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10103	10103	\N	\N
5296	turner-ottenbreit	Turner Ottenbreit	D	298	8478937	\N	\N	\N	\N	1997-07-09	Yorkton, Saskatchewan, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8478937.png	L	192	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7099	7099	\N	\N
5329	jake-wise	Jake Wise	F	303	8480793	\N	\N	\N	\N	2000-02-28	Naples, Florida, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/COL/8480793.png	L	189	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9723	9723	\N	\N
5124	sean-behrens	Sean Behrens	D	303	8482676	\N	911667	2027	1	2003-03-31	Barrington, Illinois, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/COL/8482676.png	L	177	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10163	10163	\N	\N
5161	caedan-bankier	Caedan Bankier	C	308	8482863	\N	850000	2027	1	2003-01-26	White Rock, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8482863.png	L	192	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9859	9859	\N	\N
5272	marc-mclaughlin	Marc Mclaughlin	F	329	8483397	\N	850000	2027	1	1999-07-26	North Billerica, Massachusetts, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8483397.png	R	202	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9036	9036	\N	marc-mclaughlin
5194	ethan-samson	Ethan Samson	D	320	8482890	\N	850000	2027	1	2003-08-23	Delta, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8482890.png	R	180	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9823	9823	\N	\N
5186	owen-allard	Owen Allard	F	323	8483798	\N	894167	2027	1	2004-01-13	Renfrew, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8483798.png	L	190	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10208	10208	\N	\N
5250	jack-peart	Jack Peart	D	308	8482686	\N	930833	2027	1	2003-05-15	Grand Rapids, Minnesota, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8482686.png	L	186	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10067	10067	\N	\N
5319	xavier-simoneau	Xavier Simoneau	C	309	8481794	\N	855000	2025	0	2001-05-19	Gatineau, Quebec, CAN	5'7"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8481794.png	L	178	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9523	9523	\N	\N
5235	luke-krys	Luke Krys	D	329	8484822	\N	875000	2028	2	2000-09-27	Ridgefield, Connecticut, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8484822.png	R	188	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10044	10044	\N	luke-krys
5306	julian-lutz	Julian Lutz	F	323	8483483	\N	923333	2027	1	2004-02-29	Weingarten, DEU	6'1"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8483483.png	L	185	C/LW/RW	DEU	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9207	9207	\N	\N
5278	zach-dean	Zach Dean	F	319	8482784	\N	850000	2027	1	2003-01-04	Grande Prairie, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/STL/8482784.png	L	176	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9268	9268	\N	\N
5240	tyler-thorpe	Tyler Thorpe	R	309	8484533	\N	968333	2028	2	2005-08-11	Richmond, British Columbia, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8484533.png	R	210	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10601	10601	\N	\N
5152	mike-hardman	Mike Hardman	L	329	8482635	\N	775000	2026	0	1999-02-05	Hanover, Massachusetts, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8482635.png	L	205	LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8910	8910	\N	mike-hardman
5298	ayrton-martino	Ayrton Martino	F	321	8482690	\N	905000	2027	1	2002-09-28	Toronto, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8482690.png	L	186	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10522	10522	\N	\N
5264	brad-lambert	Brad Lambert	F	311	8483471	\N	950000	2027	1	2003-12-19	Lahti, FIN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8483471.png	R	173	C/RW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9557	9557	\N	\N
5343	simon-lundmark	Simon Lundmark	D	329	8481547	\N	812500	2027	1	2000-10-08	Stockholm, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8481547.png	R	190	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8922	8922	\N	simon-lundmark
5316	tobias-bjornfot	Tobias Bjornfot	D	299	8481600	\N	850000	2027	1	2001-04-06	Upplands Vasby, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8481600.png	L	200	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7687	7687	\N	\N
5308	luke-prokop	Luke Prokop	D	296	8482091	\N	813333	2025	0	2002-05-06	Edmonton, Alberta, CAN	6'6"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8482091.png	R	224	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9384	9384	\N	\N
5267	dominik-badinka	Dominik Badinka	D	300	8484781	\N	869050	2029	3	2005-11-27	Chomutov, CZE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8484781.png	R	199	D	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10622	10622	\N	\N
5303	gavin-white	Gavin White	D	329	8483059	\N	857500	2026	0	2002-11-12	Brockville, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8483059.png	R	195	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9962	9962	\N	gavin-white
5256	nate-danielson	Nate Danielson	C	304	8484160	\N	950000	2028	2	2004-09-27	Edmonton, Alberta, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/DET/8484160.png	R	195	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10188	10188	\N	\N
5311	matvey-petrov	Matvey Petrov	R	329	\N	\N	843333	2026	0	2003-03-12	\N	6'2	\N	R	178	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9942	9942	\N	matvey-petrov
5245	cal-burke	Cal Burke	C	317	\N	\N	\N	\N	\N	1997-03-24	\N	5.10	\N	R	183	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8575	8575	\N	\N
13183	elmer-s-derblom	Elmer S�derblom	RW	16	\N	\N	\N	\N	\N	2001-07-05	\N	6'8	\N	L	252	\N	SWE	https://frozenpool.dobbersports.com/players/elmer-s-derblom	\N	\N	\N
13181	nicklaus-perbix	Nicklaus Perbix	D	22	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/nicklaus-perbix	\N	\N	\N
5367	tommy-miller	Tommy Miller	D	320	8480067	\N	\N	\N	\N	1999-03-06	West Bloomfield, Michigan, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8480067.png	R	181	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9079	9079	\N	\N
5423	joe-arntsen	Joe Arntsen	D	295	8483822	\N	\N	\N	\N	2003-05-22	Saskatoon, Saskatchewan, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8483822.png	L	210	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10146	10146	\N	\N
5355	jakov-novak	Jakov Novak	F	302	8481078	\N	\N	\N	\N	1998-10-22	Windsor, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8481078.png	L	202	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9797	9797	\N	\N
5377	jack-millar	Jack Millar	D	313	8484934	\N	\N	\N	\N	2000-11-30	Westminster, Colorado, USA	6'5"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8484934.png	R	220	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10125	10125	\N	\N
5402	mark-duarte	Mark Duarte	R	297	8483856	\N	\N	\N	\N	2002-09-27	Hamilton, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8483856.png	R	187	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9684	9684	\N	\N
5431	ryan-gagnier	Ryan Gagnier	C	316	8484382	\N	\N	\N	\N	2002-07-16	Tecumseh, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8484382.png	L	187	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9840	9840	\N	\N
5457	sean-chisholm	Sean Chisholm	F	321	\N	\N	\N	\N	\N	2001-01-26	\N	6.01	\N	L	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10527	10527	\N	\N
5427	lucas-vanroboys	Lucas Vanroboys	F	318	8484908	\N	\N	\N	\N	1999-07-24	Thamesville, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8484908.png	R	190	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10100	10100	\N	\N
5462	tommy-bergsland	Tommy Bergsland	D	321	\N	\N	\N	\N	\N	2001-03-23	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10517	10517	\N	\N
5386	wyatt-newpower	Wyatt Newpower	D	319	8482251	\N	\N	\N	\N	1997-12-09	Hugo, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/STL/8482251.png	R	207	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8584	8584	\N	\N
5438	colton-huard	Colton Huard	D	299	\N	\N	\N	\N	\N	2000-11-27	\N	6'4	\N	R	225	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10507	10507	\N	\N
5403	mason-millman	Mason Millman	D	296	8481658	\N	\N	\N	\N	2001-07-18	London, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8481658.png	L	175	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7847	7847	\N	\N
5453	liam-mclinskey	Liam Mclinskey	F	299	\N	\N	\N	\N	\N	2001-02-20	\N	6'3	\N	R	165	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10550	10550	\N	\N
13187	emil-martinsen-lilleberg	Emil Martinsen Lilleberg	D	32	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/emil-martinsen-lilleberg	\N	\N	\N
5422	jalen-luypen	Jalen Luypen	C	307	8482903	\N	859167	2025	0	2002-06-28	Kelowna, British Columbia, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8482903.png	L	155	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9711	9711	\N	\N
5455	parker-bell	Parker Bell	L	329	8483772	\N	857500	2026	0	2003-09-26	Estevan, Saskatchewan, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8483772.png	L	192	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9726	9726	\N	parker-bell
5372	chase-stillman	Chase Stillman	R	295	8482714	\N	850000	2027	1	2003-03-19	St. Louis, Missouri, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8482714.png	R	185	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8749	8749	\N	\N
5470	givani-smith	Givani Smith	L	329	8479379	\N	775000	2026	0	1998-02-27	Toronto, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8479379.png	L	214	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6657	6657	\N	givani-smith
5429	nikolai-knyzhov	Nikolai Knyzhov	D	329	8481812	\N	1250000	2026	0	1998-03-20	Kemerovo, RUS	6'3"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8481812.png	L	222	D	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7746	7746	\N	nikolai-knyzhov
5411	cam-allen	Cam Allen	D	307	8484140	\N	886667	2028	2	2005-01-07	Toronto, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8484140.png	R	194	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10133	10133	\N	\N
5384	taige-harding	Taige Harding	D	316	8482923	\N	905000	2027	1	2002-01-03	Glasgow, GBR	6'6"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8482923.png	L	235	D	GBR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10563	10563	\N	\N
5380	lucas-ciona	Lucas Ciona	L	329	8482889	\N	849167	2026	0	2003-01-08	Edmonton, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8482889.png	L	210	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9952	9952	\N	lucas-ciona
5447	jakub-dvorak	Jakub Dvorak	D	313	8484163	\N	900000	2028	2	2005-05-25	Liberec, CZE	6'5"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8484163.png	L	203	D	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10199	10199	\N	\N
5405	mikael-diotte	Mikael Diotte	D	324	8483085	\N	950000	2027	1	2003-04-10	Sainte-julie, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8483085.png	R	205	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10442	10442	\N	\N
5449	kai-schwindt	Kai Schwindt	F	299	\N	\N	836667	2027	1	2003-12-07	\N	6'6	\N	L	197	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9721	9721	\N	\N
5370	brody-lamb	Brody Lamb	F	305	\N	\N	980000	2028	2	2003-08-30	\N	6'1	\N	R	179	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10979	10979	\N	\N
5541	easton-cowan	Easton Cowan	L	322	8484158	\N	935833	2028	2	2005-05-20	Mount Brydges, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8484158.png	L	190	C/LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10929	10929	\N	\N
5445	isaac-belliveau	Isaac Belliveau	D	329	8482801	\N	875000	2026	0	2002-11-26	Fleurimont, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8482801.png	L	193	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9803	9803	\N	isaac-belliveau
5491	zach-uens	Zach Uens	D	302	8482098	\N	\N	\N	\N	2001-05-13	Belleville, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8482098.png	L	190	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9029	9029	\N	\N
5531	blake-biondi	Blake Biondi	C	300	8482114	\N	\N	\N	\N	2002-04-24	Duluth, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8482114.png	R	197	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10511	10511	\N	\N
5516	mark-liwiski	Mark Liwiski	F	308	8483904	\N	\N	\N	\N	2001-08-08	Dauphin, Manitoba, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8483904.png	L	195	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9472	9472	\N	\N
5500	chase-yoder	Chase Yoder	C	311	8482195	\N	\N	\N	\N	2002-05-28	Fairview, Texas, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8482195.png	L	176	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10910	10910	\N	\N
5546	harrison-israels	Harrison Israels	C	316	8485555	\N	\N	\N	\N	1999-09-01	Mississauga, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8485555.png	L	205	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10761	10761	\N	\N
5535	carter-berger	Carter Berger	D	310	\N	\N	\N	\N	\N	1999-09-17	\N	6.00	\N	L	201	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10374	10374	\N	\N
5502	colin-felix	Colin Felix	D	314	8483590	\N	\N	\N	\N	1999-01-07	Cambden, New Jersey, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8483590.png	R	203	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9148	9148	\N	\N
5543	ellis-rickwood	Ellis Rickwood	F	321	\N	\N	\N	\N	\N	2002-07-02	\N	6.02	\N	R	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11083	11083	\N	\N
5561	matt-copponi	Matt Copponi	C	296	8484491	\N	\N	\N	\N	2003-06-04	Mansfield, Massachusetts, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8484491.png	R	174	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10624	10624	\N	\N
5550	joe-dunlap	Joe Dunlap	R	309	\N	\N	\N	\N	\N	1999-11-30	\N	6.00	\N	R	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10600	10600	\N	\N
5570	phip-waugh	Phip Waugh	D	305	\N	\N	\N	\N	\N	2000-01-10	\N	6.04	\N	L	220	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10023	10023	\N	\N
5495	ben-king	Ben King	C	322	8482976	\N	\N	\N	\N	2002-05-15	Vernon, British Columbia, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8482976.png	R	200	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9188	9188	\N	\N
5562	matt-dimarsico	Matt Dimarsico	L	303	\N	\N	\N	\N	\N	2004-01-07	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11022	11022	\N	\N
5573	riley-mckay	Riley Mckay	F	306	8482263	\N	\N	\N	\N	1999-03-07	Swan River, Manitoba, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8482263.png	L	203	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8421	8421	\N	\N
5522	tim-rego	Tim Rego	D	313	8485508	\N	\N	\N	\N	2000-10-31	Mansfield, Massachusetts, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8485508.png	R	185	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10616	10616	\N	\N
5581	artur-cholach	Artur Cholach	D	306	\N	\N	\N	\N	\N	2003-06-06	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9277	9277	\N	\N
5614	nolan-moyle	Nolan Moyle	R	304	8485884	\N	\N	\N	\N	1999-04-13	Briarcliff Manor, New York, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/DET/8485884.png	R	198	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10932	10932	\N	\N
5607	matt-basgall	Matt Basgall	D	317	\N	\N	\N	\N	\N	2002-08-16	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11037	11037	\N	\N
5616	reilly-connors	Reilly Connors	C	303	8485733	\N	\N	\N	\N	2000-03-17	Madison, Connecticut, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/COL/8485733.png	R	190	C/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10661	10661	\N	\N
5686	reece-vitelli	Reece Vitelli	R	311	8483124	\N	\N	\N	\N	2001-07-05	Winnipeg, Manitoba, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8483124.png	R	180	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9211	9211	\N	\N
5633	aidan-hreschuk	Aidan Hreschuk	D	321	\N	\N	\N	\N	\N	2003-02-19	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10906	10906	\N	\N
5645	chris-ortiz	Chris Ortiz	D	305	\N	\N	\N	\N	\N	2001-01-17	\N	5.10	\N	L	180	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8789	8789	\N	\N
5481	otto-salin	Otto Salin	D	313	8483509	\N	912500	2028	2	2004-03-07	Helsinki, FIN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8483509.png	R	187	D	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10567	10567	\N	\N
4871	ryan-ufko	Ryan Ufko	D	312	8482715	\N	930833	2027	1	2003-05-07	Smithtown, New York, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8482715.png	R	174	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10078	10078	\N	\N
5526	aidan-fulp	Aidan Fulp	D	315	8484263	\N	870000	2025	0	2000-02-29	Westfield, Indiana, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8484263.png	R	214	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9688	9688	\N	\N
5518	noah-powell	Noah Powell	R	310	8485045	\N	985000	2029	3	2005-02-02	Northbrook, Illinois, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8485045.png	R	201	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10976	10976	\N	\N
5539	cole-knuble	Cole Knuble	C	310	\N	\N	980000	2028	2	2004-07-01	\N	5'10	\N	R	184	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11009	11009	\N	\N
5569	patrick-thomas	Patrick Thomas	L	307	\N	\N	920000	2028	2	2004-08-21	\N	6'0	\N	L	172	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10153	10153	\N	\N
5478	luke-mittelstadt	Luke Mittelstadt	D	309	\N	\N	1013750	2028	2	2003-01-22	\N	5'11	\N	L	178	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10978	10978	\N	\N
5167	scott-morrow	Scott Morrow	D	305	8482666	\N	916667	2026	0	2002-11-01	Darien, Connecticut, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8482666.png	R	210	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10465	10465	\N	\N
5622	t-j-hughes	T.j. Hughes	C	303	\N	\N	952500	2027	1	2001-11-09	\N	6.00	\N	R	183	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11073	11073	\N	\N
5484	shane-bowers	Shane Bowers	F	329	8480032	\N	775000	2026	0	1999-07-30	Halifax, Nova Scotia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8480032.png	L	186	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7591	7591	\N	shane-bowers
5620	sheldon-rempal	Sheldon Rempal	R	329	\N	\N	775000	2026	0	1995-08-07	\N	5'11	\N	R	173	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7285	7285	\N	sheldon-rempal
5648	connor-mayer	Connor Mayer	D	307	\N	\N	\N	\N	\N	1999-06-13	\N	5.11	\N	L	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10255	10255	\N	\N
5654	drew-elliott	Drew Elliott	L	317	\N	\N	\N	\N	\N	2003-04-04	\N	5.10	\N	L	196	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9201	9201	\N	\N
5667	josh-nadeau	Josh Nadeau	F	309	\N	\N	\N	\N	\N	2003-10-22	\N	5.08	\N	R	165	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11005	11005	\N	\N
5670	liam-valente	Liam Valente	C	315	\N	\N	\N	\N	\N	2003-05-23	\N	6.00	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11056	11056	\N	\N
5650	david-lewandowski	David Lewandowski	F	296	\N	\N	\N	\N	\N	2007-02-20	\N	6'1	\N	L	177	\N	DEU	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11097	11097	\N	\N
5595	jackson-kunz	Jackson Kunz	C	295	8482198	\N	\N	\N	\N	2002-08-13	Lincoln, Nebraska, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8482198.png	L	210	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10524	10524	\N	\N
5656	isak-walther	Isak Walther	R	312	\N	\N	\N	\N	\N	2001-08-02	\N	6'6	\N	L	204	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10831	10831	\N	\N
5688	robby-drazner	Robby Drazner	D	295	\N	\N	\N	\N	\N	2000-02-13	\N	6.01	\N	R	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10927	10927	\N	\N
5693	sawyer-boulton	Sawyer Boulton	F	310	\N	\N	\N	\N	\N	2004-07-12	\N	6.00	\N	R	209	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10300	10300	\N	\N
5598	jarod-crespo	Jarod Crespo	D	318	\N	\N	\N	\N	\N	2002-04-30	\N	6.00	\N	R	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11079	11079	\N	\N
5602	kaden-bohlsen	Kaden Bohlsen	F	307	\N	\N	\N	\N	\N	2001-01-10	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10558	10558	\N	\N
5583	charlie-wright	Charlie Wright	D	302	\N	\N	\N	\N	\N	2003-10-22	\N	6.01	\N	L	179	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10385	10385	\N	\N
5796	vincent-sevigny	Vincent Sevigny	D	310	8481762	\N	\N	\N	\N	2001-04-14	Quebec City, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8481762.png	L	200	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7690	7690	\N	\N
5799	xavier-bernard	Xavier Bernard	D	298	8480886	\N	\N	\N	\N	2000-01-06	Lery, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8480886.png	L	205	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8858	8858	\N	\N
5731	deni-goure	Deni Goure	C	300	\N	\N	\N	\N	\N	2003-07-15	\N	5.11	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10309	10309	\N	\N
5750	jacob-dion	Jacob Dion	D	309	\N	\N	\N	\N	\N	2001-11-01	\N	5.09	\N	L	177	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10782	10782	\N	\N
5752	jake-murray	Jake Murray	D	316	\N	\N	\N	\N	\N	2002-04-11	\N	6.03	\N	L	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9965	9965	\N	\N
5754	jayden-lee	Jayden Lee	D	295	8485173	\N	\N	\N	\N	2001-02-15	North Vancouver, British Columbia, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8485173.png	R	175	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10339	10339	\N	\N
5726	colin-swoyer	Colin Swoyer	D	301	8483533	\N	\N	\N	\N	1998-03-31	Hinsdale, Illinois, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8483533.png	R	192	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9069	9069	\N	\N
5762	kyle-walker	Kyle Walker	D	298	\N	\N	\N	\N	\N	2000-07-09	\N	6.02	\N	L	203	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11043	11043	\N	\N
5759	kent-anderson	Kent Anderson	D	298	\N	\N	\N	\N	\N	2003-11-03	\N	6.00	\N	L	210	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11082	11082	\N	\N
5766	lukas-sillinger	Lukas Sillinger	L	308	\N	\N	\N	\N	\N	2000-09-14	\N	5.10	\N	L	170	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10943	10943	\N	\N
5757	josh-eernisse	Josh Eernisse	R	301	\N	\N	\N	\N	\N	2001-12-31	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11072	11072	\N	\N
5774	owen-lindmark	Owen Lindmark	C	317	8481531	\N	\N	\N	\N	2001-05-17	Enid, Oklahoma, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8481531.png	R	192	C/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10502	10502	\N	\N
5631	zac-funk	Zac Funk	L	307	\N	\N	905000	2027	1	2003-07-20	\N	6'0	\N	L	210	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10187	10187	\N	\N
5637	blake-montgomery	Blake Montgomery	L	297	\N	\N	1075000	2029	3	2005-05-04	\N	6'4	\N	L	178	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11087	11087	\N	\N
5664	josh-davies	Josh Davies	L	312	8483740	\N	855000	2027	1	2004-03-24	Calgary, Alberta, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8483740.png	L	197	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9664	9664	\N	\N
500	nikita-chibrikov	Nikita Chibrikov	L	311	8482787	90	875000	2028	2	2003-02-16	Moscow, RUS	5'10"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8482787.png	L	170	LW/RW	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9759	9759	\N	\N
5658	jack-berglund	Jack Berglund	C	310	\N	\N	1075000	2029	3	2006-04-10	\N	6'3	\N	L	209	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11066	11066	\N	\N
5671	ludwig-persson	Ludwig Persson	R	307	\N	\N	878333	2027	1	2003-10-08	\N	6'0	\N	L	185	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9705	9705	\N	\N
5678	maxim-strbak	Maxim Strbak	D	315	\N	\N	1028333	2029	3	2005-04-13	\N	6'2	\N	R	196	\N	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11038	11038	\N	\N
5683	noah-steen	Noah Steen	L	320	\N	\N	972500	2028	2	2004-08-16	\N	6'1	\N	L	187	\N	NOR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11025	11025	\N	\N
5600	jiri-felcman	Jiri Felcman	F	316	\N	\N	996667	2029	3	2005-04-17	\N	6'4	\N	L	198	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10059	10059	\N	\N
5736	emil-hemming	Emil Hemming	F	321	\N	\N	975000	2029	3	2006-06-27	\N	6'2	\N	R	211	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10648	10648	\N	\N
5738	ethan-czata	Ethan Czata	C	320	\N	\N	931667	2029	3	2007-05-29	\N	6'1	\N	L	179	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11060	11060	\N	\N
4905	tristan-luneau	Tristan Luneau	D	317	8483482	\N	896667	2027	1	2004-01-12	Victoriaville, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8483482.png	R	211	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9194	9194	\N	\N
13192	maxwell-crozier	Maxwell Crozier	D	329	\N	\N	825000	2028	2	\N	\N	\N	\N	\N	\N	D	\N	https://frozenpool.dobbersports.com/players/maxwell-crozier	\N	\N	maxwell-crozier
5697	tyson-feist	Tyson Feist	D	296	8483109	\N	\N	\N	\N	2001-01-14	Grande Prairie, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8483109.png	R	200	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9170	9170	\N	\N
5771	max-andreev	Max Andreev	L	314	\N	\N	\N	\N	\N	1998-10-22	\N	6.00	\N	L	183	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9682	9682	\N	\N
5773	nathan-brown	Nathan Brown	C	297	\N	\N	\N	\N	\N	2006-02-27	\N	6.00	\N	L	163	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11077	11077	\N	\N
5780	ryan-mccleary	Ryan Mccleary	D	322	\N	\N	\N	\N	\N	2003-09-09	\N	6.03	\N	L	182	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9883	9883	\N	\N
5720	chad-nychuk	Chad Nychuk	D	312	8483834	\N	\N	\N	\N	2001-03-06	Rossburn, Manitoba, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8483834.png	L	194	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9601	9601	\N	\N
5785	samuel-mayer	Samuel Mayer	D	306	\N	\N	\N	\N	\N	2003-04-15	\N	6.03	\N	L	210	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9261	9261	\N	\N
5792	tristan-sarsland	Tristan Sarsland	D	318	\N	\N	\N	\N	\N	2004-02-25	\N	6.01	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11007	11007	\N	\N
5783	sam-sedley	Sam Sedley	D	297	\N	\N	\N	\N	\N	2003-06-08	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10294	10294	\N	\N
5794	tyler-weiss	Tyler Weiss	L	300	\N	\N	\N	\N	\N	2000-01-03	\N	5.10	\N	L	158	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9913	9913	\N	\N
5801	zach-okabe	Zach Okabe	C	295	\N	\N	\N	\N	\N	2001-01-04	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10064	10064	\N	\N
5704	alex-gaffney	Alex Gaffney	L	307	\N	\N	\N	\N	\N	2002-06-25	\N	5.08	\N	R	177	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11001	11001	\N	\N
5712	ben-meehan	Ben Meehan	D	310	\N	\N	\N	\N	\N	2001-04-20	\N	6.00	\N	L	188	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10549	10549	\N	\N
5714	ben-zloty	Ben Zloty	D	311	\N	\N	\N	\N	\N	2002-02-24	\N	6.00	\N	L	188	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9960	9960	\N	\N
5717	brendan-gorman	Brendan Gorman	F	313	\N	\N	\N	\N	\N	2003-02-17	\N	6.00	\N	R	175	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11021	11021	\N	\N
5722	chongmin-lee	Chongmin Lee	F	301	\N	\N	\N	\N	\N	1999-05-10	\N	5.11	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10379	10379	\N	\N
5699	vinny-borgesi	Vinny Borgesi	D	322	\N	\N	\N	\N	\N	2004-03-02	\N	5'9	\N	R	174	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10991	10991	\N	\N
5459	spencer-kersten	Spencer Kersten	R	320	8485337	\N	\N	\N	\N	2000-05-16	Waterloo, Ontario, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8485337.png	R	185	LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10399	10399	\N	\N
5582	brandon-holt	Brandon Holt	D	323	\N	\N	\N	\N	\N	2001-04-30	\N	5.11	\N	L	180	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11033	11033	\N	\N
5510	jackson-van-de-leest	Jackson Van De Leest	D	324	8481820	\N	\N	\N	\N	2001-06-15	Kelowna, British Columbia, CAN	6'6"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8481820.png	L	225	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8778	8778	\N	\N
5646	christopher-brown	Christopher Brown	R	314	\N	\N	\N	\N	\N	1996-02-22	\N	6.00	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7564	7564	\N	\N
5689	ryan-chyzowski	Ryan Chyzowski	C	298	\N	\N	\N	\N	\N	2000-05-14	\N	6.01	\N	L	177	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7776	7776	\N	\N
5743	hayes-hundley	Hayes Hundley	D	322	\N	\N	1010000	2029	3	2005-03-22	\N	6.02	\N	R	207	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11019	11019	\N	\N
5255	mattias-havelid	Mattias Havelid	D	318	8483666	\N	921667	2028	2	2004-01-01	Taby, SWE	5'10"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8483666.png	R	170	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10699	10699	\N	\N
90	nick-suzuki	Nick Suzuki	C	21	8480018	14	7875000	2030	4	1999-08-10	London, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8480018.png	R	207	C	CAN	\N	\N	\N	\N
67	quinn-hughes	Quinn Hughes	D	329	8480800	43	7850000	2027	1	1999-10-14	Orlando, Florida, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8480800.png	L	180	D	USA	\N	\N	\N	quinn-hughes
5126	stian-solberg	Stian Solberg	D	317	8484859	\N	975000	2029	3	2005-12-29	Oslo, NOR	6'2"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8484859.png	L	207	D	NOR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10506	10506	\N	\N
97	lane-hutson	Lane Hutson	D	21	8483457	48	8850000	2034	8	2004-02-14	Holland, Michigan, USA	5'9"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8483457.png	L	162	D	USA	\N	\N	\N	\N
24	devon-levi	Devon Levi	G	1	8482221	27	812500	2027	1	2001-12-27	Dollard-des-Ormeaux, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8482221.png	L	192	\N	CAN	\N	\N	\N	\N
30	adrian-kempe	Adrian Kempe	R	19	8477960	9	10625000	2034	8	1996-09-13	Kramfors, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8477960.png	L	205	LW/RW	SWE	\N	\N	\N	\N
19	connor-murphy	Connor Murphy	D	1	8476473	5	4100000	2031	5	1993-03-26	Boston, Massachusetts, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8476473.png	R	212	D	USA	\N	\N	\N	\N
48	darcy-kuemper	Darcy Kuemper	G	329	8475311	35	5250000	2027	1	1990-05-05	Saskatoon, Saskatchewan, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8475311.png	L	215	\N	CAN	\N	\N	\N	darcy-kuemper
5280	andreas-englund	Andreas Englund	D	329	8477971	\N	900000	2027	1	1996-01-21	Stockholm, SWE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8477971.png	L	200	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6403	6403	\N	andreas-englund
596	zach-metsa	Zach Metsa	D	329	8484305	73	775000	2027	1	1998-10-19	Delafield, Wisconsin, USA	5'9"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8484305.png	R	198	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9743	9743	\N	zach-metsa
112	filip-forsberg	Filip Forsberg	L	22	8476887	9	8500000	2030	4	1994-08-13	Ostervala, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8476887.png	R	205	LW/RW	SWE	\N	\N	\N	\N
84	phillip-danault	Phillip Danault	C	329	8476479	24	5500000	2027	1	1993-02-24	Victoriaville, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8476479.png	L	200	C/RW	CAN	\N	\N	\N	phillip-danault
76	calvin-pickard	Calvin Pickard	G	329	8475717	31	1000000	2027	1	1992-04-15	Moncton, New Brunswick, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8475717.png	L	206	\N	CAN	\N	\N	\N	calvin-pickard
5193	daniel-d-amato	Daniel D'amato	L	296	8483063	\N	\N	\N	\N	2001-04-08	North York, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8483063.png	L	194	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8846	8846	\N	\N
5718	brooklyn-kalmikov	Brooklyn Kalmikov	L	314	8483658	\N	\N	\N	\N	2001-04-21	St. John's, Newfoundland and Labrador, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8483658.png	L	174	LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9363	9363	\N	\N
10226	matt-dumba	Matt Dumba	D	325	8476856	\N	\N	\N	\N	1994-07-25	Regina, Saskatchewan, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8476856.png	R	191	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4933	4933	\N	\N
10349	alex-alexeyev	Alex Alexeyev	D	325	\N	\N	\N	\N	\N	1999-11-15	\N	6.04	\N	L	213	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7632	7632	\N	\N
10440	phil-kemp	Phil Kemp	D	325	\N	\N	\N	\N	\N	1999-02-12	\N	6.03	\N	R	212	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8664	8664	\N	\N
10591	david-breazeale	David Breazeale	D	325	\N	\N	\N	\N	\N	2000-04-22	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10634	10634	\N	\N
10757	dylan-moulton	Dylan Moulton	D	311	\N	\N	\N	\N	\N	2001-04-24	\N	6.02	\N	L	203	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10966	10966	\N	\N
10809	zach-urdahl	Zach Urdahl	F	325	8485558	\N	\N	\N	\N	2001-10-13	Eau Claire, Wisconsin, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8485558.png	L	195	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10852	10852	\N	\N
10538	nolan-renwick	Nolan Renwick	R	325	\N	\N	\N	\N	\N	2001-02-16	\N	6'3	\N	R	212	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10560	10560	\N	\N
10764	jackson-jutting	Jackson Jutting	F	304	\N	\N	\N	\N	\N	2001-02-27	\N	5.11	\N	L	186	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10829	10829	\N	\N
10848	drake-burgin	Drake Burgin	D	302	\N	\N	\N	\N	\N	2000-10-22	\N	5.11	\N	R	180	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10965	10965	\N	\N
10879	lachlan-getz	Lachlan Getz	D	319	\N	\N	\N	\N	\N	2002-02-01	\N	6.03	\N	R	195	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10980	10980	\N	\N
10887	mason-mccormick	Mason Mccormick	C	312	\N	\N	\N	\N	\N	2001-05-25	\N	6.03	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10998	10998	\N	\N
10704	mathieu-de-st-phalle	Mathieu De St. Phalle	R	325	8484909	\N	\N	\N	\N	2000-03-20	Glencoe, Illinois, USA	5'9"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8484909.png	R	165	C/LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10085	10085	\N	\N
10894	nick-andrews	Nick Andrews	D	304	\N	\N	\N	\N	\N	2001-07-06	\N	5.10	\N	L	193	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10971	10971	\N	\N
10827	brent-johnson	Brent Johnson	D	325	\N	\N	\N	\N	\N	1977-03-12	\N	6' 3	\N	L	199	\N	Uni	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10619	10619	\N	\N
10683	daniel-russell	Daniel Russell	F	325	\N	\N	\N	\N	\N	2001-11-16	\N	5.09	\N	L	153	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11044	11044	\N	\N
14	matt-savoie	Matt Savoie	C	1	8483512	22	950000	2027	1	2004-01-01	St. Albert, Alberta, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8483512.png	R	179	C	CAN	\N	\N	\N	\N
104	jacob-fowler	Jacob Fowler	G	21	8484170	32	938333	2028	2	2004-11-24	Melbourne, Florida, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8484170.png	L	223	\N	USA	\N	\N	\N	\N
36	alex-turcotte	Alex Turcotte	C	19	8481532	15	800000	2027	1	2001-02-26	Elk Grove, Illinois, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8481532.png	L	195	C	USA	\N	\N	\N	\N
9883	adam-beckman	Adam Beckman	L	329	8481550	\N	875000	2028	2	2001-05-10	Saskatoon, Saskatchewan, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8481550.png	L	192	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8549	8549	\N	adam-beckman
4830	nikita-alexandrov	Nikita Alexandrov	F	329	8481543	\N	775000	2026	0	2000-09-16	Burgwedel, DEU	6'1"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8481543.png	L	189	C	DEU	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8718	8718	\N	nikita-alexandrov
15	evan-bouchard	Evan Bouchard	D	329	8480803	2	10500000	2029	3	1999-10-20	Oakville, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8480803.png	R	192	D	CAN	\N	\N	\N	evan-bouchard
12682	melvin-fernstrom	Melvin Fernstrom	R	325	\N	\N	922500	2029	3	2006-02-28	\N	6'1	\N	R	185	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10959	10959	\N	\N
10032	marshall-warren	Marshall Warren	D	326	8481569	\N	850000	2027	1	2001-04-20	Laurel Hollow, New York, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8481569.png	L	195	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10152	10152	\N	\N
20	ryan-shea	Ryan Shea	D	1	8478854	6	4000000	2031	5	1997-02-11	Milton, Massachusetts, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8478854.png	L	200	D	USA	\N	\N	\N	\N
61	yakov-trenin	Yakov Trenin	C	329	8478508	13	3500000	2028	2	1997-01-13	Chelyabinsk, RUS	6'2"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8478508.png	L	201	C/LW	RUS	\N	\N	\N	yakov-trenin
10540	raivis-ansons	Raivis Ansons	L	325	8482456	\N	844167	2025	0	2002-01-29	Riga, LVA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8482456.png	L	190	LW/RW	LVA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9364	9364	\N	\N
10710	mikhail-ilyin	Mikhail Ilyin	F	325	\N	\N	901667	2028	2	2005-02-15	\N	6'3	\N	L	191	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11063	11063	\N	\N
10631	daniel-laatsch	Daniel Laatsch	D	325	8482952	\N	897500	2027	1	2002-02-13	Altoona, Wisconsin, USA	6'5"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8482952.png	L	191	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10850	10850	\N	\N
725	elvis-merzlikins	Elvis Merzlikins	G	329	8478007	90	5400000	2027	1	1994-04-13	Riga, LVA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8478007.png	L	190	\N	LVA	\N	\N	\N	elvis-merzlikins
23	tristan-jarry	Tristan Jarry	G	329	8477465	35	5375000	2028	2	1995-04-29	Surrey, British Columbia, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8477465.png	L	201	\N	CAN	\N	\N	\N	tristan-jarry
10296	chase-pietila	Chase Pietila	D	325	8485019	\N	910000	2028	2	2004-03-03	Howell, Michigan, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8485019.png	R	200	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10504	10504	\N	\N
42	drew-doughty	Drew Doughty	D	329	8474563	8	11000000	2027	1	1989-12-08	London, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8474563.png	R	210	D	CAN	\N	\N	\N	drew-doughty
10904	ryan-miller	Ryan Miller	F	325	\N	\N	\N	\N	\N	2007-05-03	\N	6'0	\N	L	177	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11062	11062	\N	\N
10273	cam-thiesing	Cam Thiesing	F	326	\N	\N	\N	\N	\N	2001-03-26	\N	6.00	\N	R	189	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10388	10388	\N	\N
81	zachary-bolduc	Zachary Bolduc	R	21	8482737	76	\N	\N	\N	2003-02-24	Trois-Rivières, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8482737.png	L	187	RW	CAN	\N	\N	\N	\N
396	michael-carcone	Michael Carcone	L	329	8479619	53	1750000	2028	2	1996-05-19	Ajax, Ontario, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8479619.png	L	182	LW/RW	CAN	\N	\N	\N	michael-carcone
102	arber-xhekaj	Arber Xhekaj	D	21	8482964	72	1300000	2026	0	2001-01-30	Hamilton, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8482964.png	L	240	D	CAN	\N	\N	\N	\N
125	brady-skjei	Brady Skjei	D	22	8476869	76	7000000	2031	5	1994-03-26	Lakeville, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8476869.png	L	210	D	USA	\N	\N	\N	\N
122	roman-josi	Roman Josi	D	329	8474600	59	9059000	2028	2	1990-06-01	Bern, CHE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8474600.png	L	201	D	CHE	\N	\N	\N	roman-josi
87	oliver-kapanen	Oliver Kapanen	C	21	8482775	91	930833	2027	1	2003-07-29	Timra, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8482775.png	R	194	C	SWE	\N	\N	\N	\N
178	noah-laba	Noah Laba	C	25	8483690	42	907500	2027	1	2003-08-04	Northville, Michigan, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8483690.png	R	214	C	USA	\N	\N	\N	\N
400	barrett-hayton	Barrett Hayton	C	329	8480849	27	4775000	2027	1	2000-06-09	Peterborough, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8480849.png	L	200	C/LW	CAN	\N	\N	\N	barrett-hayton
56	ryan-hartman	Ryan Hartman	R	329	8477451	38	4000000	2027	1	1994-09-20	Hilton Head Island, South Carolina, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8477451.png	R	197	C/RW	USA	\N	\N	\N	ryan-hartman
256	joseph-woll	Joseph Woll	G	329	8479361	\N	3666667	2028	2	1998-07-12	Dardenne Prairie, Missouri, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8479361.png	L	212	\N	USA	\N	\N	\N	joseph-woll
157	matias-maccelli	Matias Maccelli	L	24	8481711	\N	2250000	2027	1	2000-10-14	Turku, FIN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8481711.png	L	187	LW/RW	FIN	\N	\N	\N	\N
331	oskar-sundqvist	Oskar Sundqvist	C	329	8476897	70	850000	2027	1	1994-03-23	Boden, SWE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/STL/8476897.png	R	210	C/RW	SWE	\N	\N	\N	oskar-sundqvist
33	trevor-moore	Trevor Moore	L	329	8479675	12	4200000	2028	2	1995-03-31	Thousand Oaks, California, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8479675.png	L	195	C/LW/RW	USA	\N	\N	\N	trevor-moore
194	braden-schneider	Braden Schneider	D	25	8482073	4	5500000	2027	1	2001-09-20	Prince Albert, Saskatchewan, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8482073.png	R	206	D	CAN	\N	\N	\N	\N
49	matt-boldy	Matt Boldy	L	20	8481557	12	7000000	2030	4	2001-04-05	Milford, Massachusetts, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8481557.png	L	201	LW	USA	\N	\N	\N	\N
129	nick-bjugstad	Nick Bjugstad	C	329	8475760	72	1750000	2027	1	1992-07-17	Minneapolis, Minnesota, USA	6'6"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8475760.png	R	210	C/RW	USA	\N	\N	\N	nick-bjugstad
35	corey-perry	Corey Perry	R	329	8470621	\N	1000000	2027	1	1985-05-16	Peterborough, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8470621.png	R	210	RW	CAN	\N	\N	\N	corey-perry
149	jake-allen	Jake Allen	G	23	8474596	34	1800000	2030	4	1990-08-07	Fredericton, New Brunswick, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8474596.png	L	197	\N	CAN	\N	\N	\N	\N
79	josh-anderson	Josh Anderson	R	329	8476981	17	5500000	2027	1	1994-05-07	Burlington, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8476981.png	R	226	LW/RW	CAN	\N	\N	\N	josh-anderson
91	alexandre-texier	Alexandre Texier	L	329	8480074	85	2500000	2028	2	1999-09-13	Saint-Martin-d'Hères, FRA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8480074.png	L	196	C/LW	FRA	\N	\N	\N	alexandre-texier
60	nico-sturm	Nico Sturm	C	329	8481477	78	2000000	2027	1	1995-05-03	Augsburg, DEU	6'3"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8481477.png	L	209	C/LW	DEU	\N	\N	\N	nico-sturm
73	jared-spurgeon	Jared Spurgeon	D	329	8474716	46	7575000	2027	1	1989-11-29	Edmonton, Alberta, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8474716.png	R	166	D	CAN	\N	\N	\N	jared-spurgeon
137	anthony-mantha	Anthony Mantha	R	329	8477511	\N	4750000	2028	2	1994-09-16	Longueuil, Quebec, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8477511.png	L	240	LW/RW	CAN	\N	\N	\N	anthony-mantha
186	mika-zibanejad	Mika Zibanejad	C	25	8476459	93	8500000	2030	4	1993-04-18	Stockholm, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8476459.png	R	208	C/RW	SWE	\N	\N	\N	\N
151	mathew-barzal	Mathew Barzal	C	24	8478445	13	9150000	2031	5	1997-05-26	Coquitlam, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8478445.png	R	186	C/RW	CAN	\N	\N	\N	\N
165	scott-mayfield	Scott Mayfield	D	24	8476429	24	3500000	2030	4	1992-10-14	St. Louis, Missouri, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8476429.png	R	215	D	USA	\N	\N	\N	\N
51	blake-coleman	Blake Coleman	L	329	8476399	20	4900000	2027	1	1991-11-28	Plano, Texas, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8476399.png	L	199	LW/RW	USA	\N	\N	\N	blake-coleman
135	nico-hischier	Nico Hischier	C	23	8480002	13	11700000	2032	6	1999-01-04	Naters, CHE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8480002.png	L	200	C	CHE	\N	\N	\N	\N
171	vitek-vanecek	Vitek Vanecek	G	329	8477970	\N	1000000	2027	1	1996-01-09	Havlickuv Brod, CZE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8477970.png	L	184	\N	CZE	\N	\N	\N	vitek-vanecek
182	taylor-raddysh	Taylor Raddysh	R	329	8479390	14	1500000	2027	1	1998-02-18	Caledon, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8479390.png	R	201	LW/RW	CAN	\N	\N	\N	taylor-raddysh
71	olli-maatta	Olli Maatta	D	329	8476874	3	3500000	2028	2	1994-08-22	Jyväskylä, FIN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8476874.png	L	207	D	FIN	\N	\N	\N	olli-maatta
10831	caleb-jones	Caleb Jones	D	329	8478452	\N	900000	2027	1	1997-06-06	Arlington, Texas, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8478452.png	L	184	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6333	6333	\N	caleb-jones
278	sergei-murashov	Sergei Murashov	G	28	8483703	1	\N	\N	\N	2004-04-01	Yaroslavl, RUS	6'2"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8483703.png	R	185	\N	RUS	\N	\N	\N	\N
225	leevi-merilinen	Leevi Meriläinen	G	26	8482447	1	\N	\N	\N	2002-08-13	Oulu, FIN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8482447.png	L	196	\N	FIN	\N	\N	\N	\N
13200	calle-j-rnkrok	Calle J�rnkrok	C	2	\N	\N	\N	\N	\N	1991-09-25	\N	6'0	\N	R	193	\N	SWE	https://frozenpool.dobbersports.com/players/calle-j-rnkrok	\N	\N	\N
417	mikhail-sergachev	Mikhail Sergachev	D	34	8479410	98	8500000	2031	5	1998-06-25	Nizhnekamsk, RUS	6'3"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8479410.png	L	212	D	RUS	\N	\N	\N	\N
294	darnell-nurse	Darnell Nurse	D	29	8477498	25	9250000	2030	4	1995-02-04	Hamilton, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8477498.png	L	215	D	CAN	\N	\N	\N	\N
4857	mikael-pyyhtia	Mikael Pyyhtia	L	301	8482451	\N	875000	2028	2	2001-12-17	Turku, FIN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8482451.png	L	178	LW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9634	9634	\N	\N
275	kaedan-korczak	Kaedan Korczak	D	28	8481527	\N	3250000	2030	4	2001-01-29	Yorkton, Saskatchewan, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8481527.png	R	206	D	CAN	\N	\N	\N	\N
411	kailer-yamamoto	Kailer Yamamoto	R	329	8479977	56	1750000	2028	2	1998-09-29	Spokane, Washington, USA	5'9"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8479977.png	R	178	LW/RW	USA	\N	\N	\N	kailer-yamamoto
243	simon-benoit	Simon Benoit	D	329	8481122	\N	1350000	2027	1	1998-09-19	Laval, Quebec, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8481122.png	L	210	D	CAN	\N	\N	\N	simon-benoit
384	john-tavares	John Tavares	C	329	8475166	91	4380000	2029	3	1990-09-20	Mississauga, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8475166.png	L	217	C/LW	CAN	\N	\N	\N	john-tavares
516	dylan-samberg	Dylan Samberg	D	329	8480049	54	5750000	2028	2	1999-01-24	Saginaw, Minnesota, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8480049.png	L	216	D	USA	\N	\N	\N	dylan-samberg
341	tyler-tucker	Tyler Tucker	D	329	8481006	75	925000	2027	1	2000-03-01	Thunder Bay, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/STL/8481006.png	L	204	D	CAN	\N	\N	\N	tyler-tucker
260	connor-dewar	Connor Dewar	C	329	8480980	19	2250000	2028	2	1999-06-26	The Pas, Manitoba, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8480980.png	L	187	C	CAN	\N	\N	\N	connor-dewar
308	mackie-samoskevich	Mackie Samoskevich	R	30	8482713	11	3850000	2029	3	2002-11-15	Newtown, Connecticut, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8482713.png	R	180	RW	USA	\N	\N	\N	\N
343	joel-hofer	Joel Hofer	G	31	8480981	30	3400000	2027	1	2000-07-30	Winnipeg, Manitoba, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/STL/8480981.png	L	193	\N	CAN	\N	\N	\N	\N
404	jack-mcbain	Jack McBain	C	34	8480855	22	4250000	2030	4	2000-01-06	Toronto, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8480855.png	L	219	C/LW	CAN	\N	\N	\N	\N
348	yanni-gourde	Yanni Gourde	C	32	8476826	37	2333333	2031	5	1991-12-15	Saint-Narcisse, Quebec, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8476826.png	L	173	C/LW/RW	CAN	\N	\N	\N	\N
311	shane-wright	Shane Wright	C	30	8483524	51	950000	2027	1	2004-01-05	Burlington, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8483524.png	R	192	C	CAN	\N	\N	\N	\N
302	jordan-eberle	Jordan Eberle	R	329	8474586	7	5500000	2028	2	1990-05-15	Regina, Saskatchewan, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8474586.png	R	180	RW	CAN	\N	\N	\N	jordan-eberle
350	brandon-hagel	Brandon Hagel	L	32	8479542	38	6500000	2032	6	1998-08-27	Saskatoon, Saskatchewan, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8479542.png	L	186	LW	CAN	\N	\N	\N	\N
300	matty-beniers	Matty Beniers	C	30	8482665	10	7142857	2031	5	2002-11-05	Hingham, Massachusetts, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8482665.png	L	181	C	USA	\N	\N	\N	\N
459	mark-stone	Mark Stone	R	329	8475913	61	9500000	2027	1	1992-05-13	Winnipeg, Manitoba, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8475913.png	R	210	RW	CAN	\N	\N	\N	mark-stone
316	ryan-lindgren	Ryan Lindgren	D	329	8479324	55	4500000	2029	3	1998-02-11	Burnsville, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8479324.png	L	194	D	USA	\N	\N	\N	ryan-lindgren
368	jonas-johansson	Jonas Johansson	G	329	8477992	31	1250000	2027	1	1995-09-19	Gavle, SWE	6'5"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8477992.png	L	220	\N	SWE	\N	\N	\N	jonas-johansson
335	nathan-walker	Nathan Walker	L	329	8477573	26	887500	2028	2	1994-02-07	Cardiff, GBR	5'9"	https://assets.nhle.com/mugs/nhl/20262027/STL/8477573.png	L	191	LW	GBR	\N	\N	\N	nathan-walker
420	jaxson-stauber	Jaxson Stauber	G	329	8483530	33	812500	2027	1	1999-04-27	Wayzata, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8483530.png	L	174	\N	USA	\N	\N	\N	jaxson-stauber
320	philipp-grubauer	Philipp Grubauer	G	329	8475831	31	5900000	2027	1	1991-11-25	Rosenheim, DEU	6'1"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8475831.png	L	188	\N	DEU	\N	\N	\N	philipp-grubauer
4969	phillip-di-giuseppe	Phillip Di Giuseppe	L	329	8476858	\N	775000	2026	0	1993-10-09	Toronto, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8476858.png	L	193	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5469	5469	\N	phillip-di-giuseppe
487	tom-wilson	Tom Wilson	R	37	8476880	43	6500000	2031	5	1994-03-29	Toronto, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8476880.png	R	225	RW	CAN	\N	\N	\N	\N
363	victor-hedman	Victor Hedman	D	329	8475167	77	8000000	2029	3	1990-12-18	Ornskoldsvik, SWE	6'7"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8475167.png	L	244	D	SWE	\N	\N	\N	victor-hedman
4844	matthew-phillips	Matthew Phillips	R	317	8479547	\N	775000	2025	0	1998-04-06	Calgary, Alberta, CAN	5'8"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8479547.png	R	160	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6729	6729	\N	\N
283	barclay-goodrow	Barclay Goodrow	C	329	8476624	23	3641667	2027	1	1993-02-26	Toronto, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8476624.png	L	210	C	CAN	\N	\N	\N	barclay-goodrow
533	troy-terry	Troy Terry	R	7	8478873	19	7000000	2030	4	1997-09-10	Denver, Colorado, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8478873.png	R	193	LW/RW	USA	\N	\N	\N	\N
219	nikolas-matinpalo	Nikolas Matinpalo	D	329	8484321	33	875000	2027	1	1998-10-05	Espoo, FIN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8484321.png	R	213	D	FIN	\N	\N	\N	nikolas-matinpalo
550	michael-eyssimont	Michael Eyssimont	C	329	8479591	81	1450000	2027	1	1996-09-09	Littleton, Colorado, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8479591.png	L	195	C	USA	\N	\N	\N	michael-eyssimont
377	steven-lorentz	Steven Lorentz	C	329	8478904	18	1350000	2028	2	1996-04-13	Kitchener, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8478904.png	L	219	C	CAN	\N	\N	\N	steven-lorentz
492	timothy-liljegren	Timothy Liljegren	D	329	8480043	27	3250000	2028	2	1999-04-30	Kristianstad, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8480043.png	R	200	D	SWE	\N	\N	\N	timothy-liljegren
558	fraser-minten	Fraser Minten	C	3	8483489	93	875000	2027	1	2004-07-05	Vancouver, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8483489.png	L	204	C	CAN	\N	\N	\N	\N
561	jj-peterka	JJ Peterka	R	3	8482175	\N	7700000	2030	4	2002-01-14	Munich, DEU	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8482175.png	L	189	LW/RW	DEU	\N	\N	\N	\N
503	cole-koepke	Cole Koepke	L	329	8481043	45	1450000	2028	2	1998-05-17	Two Harbors, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8481043.png	L	207	LW	USA	\N	\N	\N	cole-koepke
360	erik-cernak	Erik Cernak	D	32	8478416	81	5200000	2031	5	1997-05-28	Kosice, SVK	6'4"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8478416.png	R	230	D	SVK	\N	\N	\N	\N
527	alex-killorn	Alex Killorn	L	329	8473986	17	6250000	2027	1	1989-09-14	Halifax, Nova Scotia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8473986.png	L	205	LW/RW	CAN	\N	\N	\N	alex-killorn
553	tanner-jeannot	Tanner Jeannot	L	3	8479661	84	3400000	2030	4	1997-05-29	Estevan, Saskatchewan, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8479661.png	L	221	LW/RW	CAN	\N	\N	\N	\N
541	pavel-mintyukov	Pavel Mintyukov	D	7	8483490	98	7200000	2031	5	2003-11-25	Moscow, RUS	6'1"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8483490.png	L	207	D	RUS	\N	\N	\N	\N
477	boone-jenner	Boone Jenner	C	37	8476432	22	5750000	2030	4	1993-06-15	Dorchester, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8476432.png	L	204	C/LW	CAN	\N	\N	\N	\N
460	kai-uchacz	Kai Uchacz	F	306	8485251	77	882500	2027	1	2003-06-24	Calgary, Alberta, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8485251.png	R	206	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10284	10284	\N	\N
621	maxim-tsyplakov	Maxim Tsyplakov	R	329	8484958	72	2250000	2027	1	1998-09-19	Moscow, RUS	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8484958.png	L	203	RW	RUS	\N	\N	\N	maxim-tsyplakov
693	jaden-schwartz	Jaden Schwartz	C	329	8475768	\N	3250000	2029	3	1992-06-25	Wilcox, Saskatchewan, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/COL/8475768.png	L	185	C/LW	CAN	\N	\N	\N	jaden-schwartz
470	parker-wotherspoon	Parker Wotherspoon	D	329	8478450	29	1000000	2027	1	1997-08-24	Surrey, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8478450.png	L	190	D	CAN	\N	\N	\N	parker-wotherspoon
444	ivan-barbashev	Ivan Barbashev	L	329	8477964	49	5000000	2028	2	1995-12-14	Moscow, RUS	6'0"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8477964.png	L	203	C/LW/RW	RUS	\N	\N	\N	ivan-barbashev
352	pontus-holmberg	Pontus Holmberg	R	329	8480995	29	1550000	2027	1	1999-03-09	Vasteras, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8480995.png	L	201	C/LW/RW	SWE	\N	\N	\N	pontus-holmberg
669	cole-smith	Cole Smith	L	329	8482062	\N	3000000	2029	3	1995-10-28	Brainerd, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8482062.png	L	195	LW/RW	USA	\N	\N	\N	cole-smith
5116	ethan-edwards	Ethan Edwards	D	324	8482194	\N	933750	2027	1	2002-06-06	Grande Prairie, Alberta, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8482194.png	L	176	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10529	10529	\N	\N
382	jack-roslovic	Jack Roslovic	C	329	8478458	\N	4000000	2028	2	1997-01-29	Columbus, Ohio, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8478458.png	R	198	C/RW	USA	\N	\N	\N	jack-roslovic
432	marco-rossi	Marco Rossi	C	35	8482079	93	5000000	2028	2	2001-09-23	Feldkirch, AUT	5'9"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8482079.png	L	182	C	AUT	\N	\N	\N	\N
534	frank-vatrano	Frank Vatrano	R	329	8478366	77	4571189	2028	2	1994-03-14	East Longmeadow, Massachusetts, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8478366.png	L	203	LW/RW	USA	\N	\N	\N	frank-vatrano
740	lian-bichsel	Lian Bichsel	D	15	8483425	6	950000	2027	1	2004-05-18	Olten, CHE	6'7"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8483425.png	L	237	D	CHE	\N	\N	\N	\N
734	wyatt-johnston	Wyatt Johnston	C	15	8482740	53	8400000	2030	4	2003-05-14	Toronto, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8482740.png	R	187	C	CAN	\N	\N	\N	\N
468	jaycob-megna	Jaycob Megna	D	329	8477034	88	825000	2027	1	1992-12-10	Plantation, Florida, USA	6'6"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8477034.png	L	214	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5547	5547	\N	jaycob-megna
684	nazem-kadri	Nazem Kadri	C	329	8475172	91	7000000	2029	3	1990-10-06	London, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/COL/8475172.png	L	185	C/LW	CAN	\N	\N	\N	nazem-kadri
592	rasmus-dahlin	Rasmus Dahlin	D	9	8480839	26	11000000	2032	6	2000-04-13	Lidkoping, SWE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8480839.png	L	204	D	SWE	\N	\N	\N	\N
656	pyotr-kochetkov	Pyotr Kochetkov	G	329	8481611	52	2000000	2027	1	1999-06-25	Penza, RUS	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8481611.png	L	196	\N	RUS	\N	\N	\N	pyotr-kochetkov
632	abram-wiebe	Abram Wiebe	D	10	8483709	52	950000	2027	1	2003-08-28	Mission, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8483709.png	L	187	\N	CAN	\N	\N	\N	\N
511	dylan-demelo	Dylan DeMelo	D	329	8476331	2	4900000	2028	2	1993-05-01	London, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8476331.png	R	194	D	CAN	\N	\N	\N	dylan-demelo
697	brett-kulak	Brett Kulak	D	13	8476967	27	4500000	2031	5	1994-01-06	Edmonton, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/COL/8476967.png	L	192	D	CAN	\N	\N	\N	\N
712	valeri-nichushkin	Valeri Nichushkin	R	14	8477501	43	6125000	2030	4	1995-03-04	Chelyabinsk, RUS	6'4"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8477501.png	L	210	LW/RW	RUS	\N	\N	\N	\N
495	rasmus-sandin	Rasmus Sandin	D	329	8480873	38	4600000	2029	3	2000-03-07	Uppsala, SWE	5'11"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8480873.png	L	189	D	SWE	\N	\N	\N	rasmus-sandin
728	oskar-bck	Oskar Bäck	C	15	8480840	10	\N	\N	\N	2000-03-12	Karlstad, SWE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8480840.png	L	207	C	SWE	\N	\N	\N	\N
134	arseny-gritsyuk	Arseny Gritsyuk	R	23	8481721	81	\N	\N	\N	2001-03-15	Krasnoyarsk, RUS	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8481721.png	L	195	RW	RUS	\N	\N	\N	\N
643	jesperi-kotkaniemi	Jesperi Kotkaniemi	C	11	8480829	82	4820000	2030	4	2000-07-06	Pori, FIN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8480829.png	L	212	C/LW	FIN	\N	\N	\N	\N
649	jalen-chatfield	Jalen Chatfield	D	329	8478970	5	3025000	2027	1	1996-05-15	Ypsilanti, Michigan, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8478970.png	R	209	D	USA	\N	\N	\N	jalen-chatfield
814	dmitry-kulikov	Dmitry Kulikov	D	329	8475179	7	1152500	2028	2	1990-10-29	Lipetsk, RUS	6'1"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8475179.png	L	212	\N	RUS	\N	\N	\N	dmitry-kulikov
601	olen-zellweger	Olen Zellweger	D	9	8482803	\N	3100000	2029	3	2003-09-10	Calgary, Alberta, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8482803.png	L	193	D	CAN	\N	\N	\N	\N
618	yegor-sharangovich	Yegor Sharangovich	C	10	8481068	17	5750000	2030	4	1998-06-06	Minsk, BLR	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8481068.png	L	196	C/LW/RW	BLR	\N	\N	\N	\N
627	jake-middleton	Jake Middleton	D	329	8478136	55	4350000	2029	3	1996-01-02	Wainwright, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8478136.png	L	219	D	CAN	\N	\N	\N	jake-middleton
675	wyatt-kaiser	Wyatt Kaiser	D	12	8482176	44	1700000	2027	1	2002-07-31	Andover, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8482176.png	L	190	D	USA	\N	\N	\N	\N
612	samuel-honzek	Samuel Honzek	L	10	8484180	29	950000	2028	2	2004-11-12	Trencin, SVK	6'4"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8484180.png	L	186	C/LW	SVK	\N	\N	\N	\N
660	ryan-donato	Ryan Donato	C	329	8477987	8	4000000	2029	3	1996-04-09	Boston, Massachusetts, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8477987.png	L	190	C	USA	\N	\N	\N	ryan-donato
587	jack-quinn	Jack Quinn	R	9	8482097	22	3375000	2027	1	2001-09-19	Ottawa, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8482097.png	R	185	LW/RW	CAN	\N	\N	\N	\N
27	kevin-fiala	Kevin Fiala	L	329	8477942	22	7875000	2029	3	1996-07-22	St. Gallen, CHE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8477942.png	L	205	LW/RW	CHE	\N	\N	\N	kevin-fiala
737	jason-robertson	Jason Robertson	L	15	8480027	21	7750000	2026	0	1999-07-22	Arcadia, California, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8480027.png	L	204	LW/RW	USA	\N	\N	\N	\N
714	cole-sillinger	Cole Sillinger	C	14	8482705	4	2250000	2026	0	2003-05-16	Columbus, Ohio, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8482705.png	L	202	C/LW	USA	\N	\N	\N	\N
722	damon-severson	Damon Severson	D	14	8476923	78	6250000	2031	5	1994-08-07	Melville, Saskatchewan, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8476923.png	R	204	D	CAN	\N	\N	\N	\N
573	jeremy-swayman	Jeremy Swayman	G	3	8480280	1	8250000	2032	6	1998-11-24	Anchorage, Alaska, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8480280.png	L	195	\N	USA	\N	\N	\N	\N
13336	kevin-reidler	KEVIN REIDLER	G	297	8483762	\N	946250	2028	2	2004-09-02	Gavle, SWE	6'7"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8483762.png	L	209	\N	SWE	https://frozenpool.dobbersports.com/players/kevin-reidler	\N	\N	\N
13359	nolan-lalonde	NOLAN LALONDE	G	301	8483869	\N	798333	2027	1	2004-02-14	Kingston, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8483869.png	L	190	\N	CAN	https://frozenpool.dobbersports.com/players/nolan-lalonde	\N	\N	\N
505	vladislav-namestnikov	Vladislav Namestnikov	C	329	8476480	7	3000000	2027	1	1992-11-22	Zhukovskiy, RUS	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8476480.png	L	181	C/LW	RUS	\N	\N	\N	vladislav-namestnikov
82	cole-caufield	Cole Caufield	R	21	8481540	13	7850000	2031	5	2001-01-02	Mosinee, Wisconsin, USA	5'8"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8481540.png	R	175	LW/RW	USA	\N	\N	\N	\N
766	moritz-seider	Moritz Seider	D	16	8481542	53	8550000	2031	5	2001-04-06	Zell, DEU	6'2"	https://assets.nhle.com/mugs/nhl/20262027/DET/8481542.png	R	210	D	DEU	\N	\N	\N	\N
190	vladislav-gavrikov	Vladislav Gavrikov	D	25	8478882	44	7000000	2032	6	1995-11-21	Yaroslavl, RUS	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8478882.png	L	210	D	RUS	\N	\N	\N	\N
94	noah-dobson	Noah Dobson	D	21	8480865	53	9500000	2033	7	2000-01-07	Summerside, Prince Edward Island, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8480865.png	R	200	D	CAN	\N	\N	\N	\N
641	mark-jankowski	Mark Jankowski	L	329	8476873	77	1850000	2028	2	1994-09-13	Hamilton, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8476873.png	L	200	C/LW	CAN	\N	\N	\N	mark-jankowski
701	devon-toews	Devon Toews	D	13	8478038	7	7250000	2031	5	1994-02-21	Abbotsford, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/COL/8478038.png	L	191	D	CAN	\N	\N	\N	\N
705	adam-fantilli	Adam Fantilli	C	14	8484166	19	950000	2026	0	2004-10-12	Nobleton, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8484166.png	L	205	C/LW	CAN	\N	\N	\N	\N
456	mitch-marner	Mitch Marner	R	36	8478483	93	12000000	2033	7	1997-05-05	Markham, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8478483.png	R	180	C/RW	CAN	\N	\N	\N	\N
686	gabriel-landeskog	Gabriel Landeskog	L	329	8476455	92	7000000	2029	3	1992-11-23	Stockholm, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/COL/8476455.png	L	215	LW/RW	SWE	\N	\N	\N	gabriel-landeskog
588	conor-sheary	Conor Sheary	L	329	8477839	43	850000	2027	1	1992-06-08	Winchester, Massachusetts, USA	5'8"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8477839.png	L	180	LW/RW	USA	\N	\N	\N	conor-sheary
591	louis-crevier	Louis Crevier	D	9	8481806	\N	900000	2027	1	2001-05-04	Quebec City, Quebec, CAN	6'8"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8481806.png	R	228	D	CAN	\N	\N	\N	\N
760	jacob-bernard-docker	Jacob Bernard-Docker	D	329	8480879	25	1600000	2028	2	2000-06-30	Canmore, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/DET/8480879.png	R	196	D	CAN	\N	\N	\N	jacob-bernard-docker
768	daniil-tarasov	Daniil Tarasov	G	329	8480193	\N	2000000	2027	1	1999-03-27	Novokuznetsk, RUS	6'5"	https://assets.nhle.com/mugs/nhl/20262027/DET/8480193.png	L	203	\N	RUS	\N	\N	\N	daniil-tarasov
491	cole-hutson	Cole Hutson	D	37	8484873	44	940833	2028	2	2006-06-28	St. Louis, Missouri, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8484873.png	L	175	D	USA	\N	\N	\N	\N
13204	david-k-mpf	David K�mpf	C	35	\N	\N	\N	\N	\N	1995-01-12	\N	6'2	\N	L	198	\N	CZE	https://frozenpool.dobbersports.com/players/david-k-mpf	\N	\N	\N
318	brandon-montour	Brandon Montour	D	30	8477986	62	7142857	2031	5	1994-04-11	Brantford, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8477986.png	R	199	D	CAN	\N	\N	\N	\N
811	gustav-forsling	Gustav Forsling	D	18	8478055	42	5750000	2032	6	1996-06-12	Linkoping, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8478055.png	L	199	D	SWE	\N	\N	\N	\N
269	bryan-rust	Bryan Rust	R	329	8475810	17	5125000	2028	2	1992-05-11	Pontiac, Michigan, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8475810.png	R	202	LW/RW	USA	\N	\N	\N	bryan-rust
235	nikita-grebenkin	Nikita Grebenkin	R	27	8483733	29	875000	2026	0	2003-05-02	Serov, RUS	6'2"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8483733.png	L	210	RW	RUS	\N	\N	\N	\N
155	simon-holmstrom	Simon Holmstrom	R	24	8481601	92	3625000	2027	1	2001-05-24	Tranas, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8481601.png	L	208	LW/RW	SWE	\N	\N	\N	\N
31	alex-laferriere	Alex Laferriere	R	19	8482155	14	4100000	2028	2	2001-10-28	Chatham, New Jersey, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8482155.png	R	205	RW	USA	\N	\N	\N	\N
563	pavel-zacha	Pavel Zacha	C	329	8478401	18	4750000	2027	1	1997-04-06	Brno, CZE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8478401.png	L	211	C/LW	CZE	\N	\N	\N	pavel-zacha
206	warren-foegele	Warren Foegele	L	329	8477998	37	3500000	2027	1	1996-04-01	Markham, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8477998.png	L	205	C/LW	CAN	\N	\N	\N	warren-foegele
763	simon-edvinsson	Simon Edvinsson	D	16	8482762	77	925000	2026	0	2003-02-05	Kungsbacka, SWE	6'6"	https://assets.nhle.com/mugs/nhl/20262027/DET/8482762.png	L	222	D	SWE	\N	\N	\N	\N
270	elmer-soderblom	Elmer Soderblom	L	28	8481725	25	1125000	2027	1	2001-07-05	Gothenburg, SWE	6'8"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8481725.png	L	252	LW	SWE	\N	\N	\N	\N
133	cody-glass	Cody Glass	C	329	8479996	12	2500000	2027	1	1999-04-01	Winnipeg, Manitoba, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8479996.png	R	201	C/RW	CAN	\N	\N	\N	cody-glass
748	jake-oettinger	Jake Oettinger	G	15	8479979	29	8250000	2033	7	1998-12-18	Lakeville, Minnesota, USA	6'6"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8479979.png	L	225	\N	USA	\N	\N	\N	\N
199	michael-amadio	Michael Amadio	R	329	8478020	22	2600000	2027	1	1996-05-13	Sault Ste. Marie, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8478020.png	R	206	C/LW/RW	CAN	\N	\N	\N	michael-amadio
72	david-spacek	David Spacek	D	308	8483766	82	850000	2027	1	2003-02-18	Columbus, Ohio, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8483766.png	R	174	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9853	9853	\N	\N
124	nick-perbix	Nick Perbix	D	329	8480246	48	2750000	2027	1	1998-06-15	Elk River, Minnesota, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8480246.png	R	206	D	USA	\N	\N	\N	nick-perbix
218	tyler-kleven	Tyler Kleven	D	26	8482095	43	1600000	2027	1	2002-01-10	Fargo, North Dakota, USA	6'5"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8482095.png	L	225	D	USA	\N	\N	\N	\N
224	samuel-ersson	Samuel Ersson	G	329	8481035	\N	2200000	2028	2	1999-10-20	Falun, SWE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8481035.png	L	194	\N	SWE	\N	\N	\N	samuel-ersson
257	justin-brazeau	Justin Brazeau	R	329	8479638	16	1500000	2027	1	1998-02-02	New Liskeard, Ontario, CAN	6'6"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8479638.png	R	232	LW/RW	CAN	\N	\N	\N	justin-brazeau
152	casey-cizikas	Casey Cizikas	C	329	8475231	53	2500000	2027	1	1991-02-27	Toronto, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8475231.png	L	191	C	CAN	\N	\N	\N	casey-cizikas
170	ilya-sorokin	Ilya Sorokin	G	24	8478009	30	8250000	2032	6	1995-08-04	Mezhdurechensk, RUS	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8478009.png	L	189	\N	RUS	\N	\N	\N	\N
193	matthew-robertson	Matthew Robertson	D	25	8481525	29	812500	2027	1	2001-03-09	Edmonton, Alberta, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8481525.png	L	210	D	CAN	\N	\N	\N	\N
200	drake-batherson	Drake Batherson	R	329	8480208	19	4975000	2027	1	1998-04-27	Fort Wayne, Indiana, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8480208.png	R	209	RW	USA	\N	\N	\N	drake-batherson
296	jacob-trouba	Jacob Trouba	D	29	8476885	65	8250000	2030	4	1994-02-26	Rochester, Michigan, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8476885.png	R	212	D	USA	\N	\N	\N	\N
309	chandler-stephenson	Chandler Stephenson	C	30	8476905	9	6250000	2031	5	1994-04-22	Saskatoon, Saskatchewan, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8476905.png	L	201	C/LW/RW	CAN	\N	\N	\N	\N
6	zach-hyman	Zach Hyman	L	329	8475786	18	5500000	2028	2	1992-06-09	Toronto, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8475786.png	R	206	LW/RW	CAN	\N	\N	\N	zach-hyman
274	erik-karlsson	Erik Karlsson	D	329	8474578	65	11500000	2027	1	1990-05-31	Landsbro, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8474578.png	R	185	D	SWE	\N	\N	\N	erik-karlsson
290	tyler-toffoli	Tyler Toffoli	C	329	8475726	73	6000000	2028	2	1992-04-24	Scarborough, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8475726.png	R	205	LW/RW	CAN	\N	\N	\N	tyler-toffoli
328	mason-mctavish	Mason McTavish	C	31	8482745	\N	7000000	2031	5	2003-01-30	Zurich, CHE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/STL/8482745.png	L	219	C/LW	CHE	\N	\N	\N	\N
164	matthew-kessel	Matthew Kessel	D	329	8482516	\N	850000	2027	1	2000-06-23	Bloomfield Hills, Michigan, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8482516.png	R	212	D	USA	\N	\N	\N	matthew-kessel
799	sam-lafferty	Sam Lafferty	C	329	8478043	18	850000	2027	1	1995-03-06	Hollidaysburg, Pennsylvania, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8478043.png	R	205	C/LW/RW	USA	\N	\N	\N	sam-lafferty
796	lars-eller	Lars Eller	C	329	8474189	20	850000	2027	1	1989-05-08	Rodovre, DNK	6'2"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8474189.png	L	207	C/LW	DNK	\N	\N	\N	lars-eller
281	ty-dellandrea	Ty Dellandrea	C	329	8480848	10	1625000	2028	2	2000-07-21	Port Perry, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8480848.png	R	185	C/LW/RW	CAN	\N	\N	\N	ty-dellandrea
679	alex-vlasic	Alex Vlasic	D	12	8481568	72	4600000	2030	4	2001-06-05	Wilmette, Illinois, USA	6'6"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8481568.png	L	217	D	USA	\N	\N	\N	\N
317	joshua-mahura	Joshua Mahura	D	30	8479372	28	\N	\N	\N	1998-05-05	St. Albert, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8479372.png	L	193	D	CAN	\N	\N	\N	\N
525	aj-greer	A.J. Greer	L	7	8478421	\N	\N	\N	\N	1996-12-14	Joliette, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8478421.png	L	224	LW	CAN	\N	\N	\N	\N
4802	seth-griffith	Seth Griffith	R	296	8476495	\N	\N	\N	\N	1993-01-04	Wallaceburg, Ontario, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8476495.png	R	190	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5080	5080	\N	\N
517	john-st-ivany	John St. Ivany	D	38	8481030	6	\N	\N	\N	1999-07-22	Manhattan Beach, California, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8481030.png	R	197	D	USA	\N	\N	\N	\N
175	will-cuylle	Will Cuylle	L	25	8482157	50	3900000	2027	1	2002-02-05	Toronto, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8482157.png	L	212	LW/RW	CAN	\N	\N	\N	\N
485	dylan-strome	Dylan Strome	C	329	8478440	17	5000000	2028	2	1997-03-07	Mississauga, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8478440.png	L	200	C/RW	CAN	\N	\N	\N	dylan-strome
251	nick-seeler	Nick Seeler	D	329	8476372	24	2700000	2028	2	1993-06-03	Eden Prairie, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8476372.png	L	197	D	USA	\N	\N	\N	nick-seeler
499	morgan-barron	Morgan Barron	C	329	8480289	36	1850000	2027	1	1998-12-02	Halifax, Nova Scotia, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8480289.png	L	220	C/LW/RW	CAN	\N	\N	\N	morgan-barron
422	brock-boeser	Brock Boeser	R	35	8478444	6	7250000	2032	6	1997-02-25	Burnsville, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8478444.png	R	208	RW	USA	\N	\N	\N	\N
147	brett-pesce	Brett Pesce	D	23	8477488	22	5500000	2030	4	1994-11-15	Tarrytown, New York, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8477488.png	R	206	D	USA	\N	\N	\N	\N
373	bo-groulx	Bo Groulx	C	329	8480870	29	812500	2027	1	2000-02-06	Rouen, FRA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8480870.png	L	202	C/LW	FRA	\N	\N	\N	bo-groulx
340	colton-parayko	Colton Parayko	D	31	8476892	55	6500000	2030	4	1993-05-12	St. Albert, Alberta, CAN	6'6"	https://assets.nhle.com/mugs/nhl/20262027/STL/8476892.png	R	228	D	CAN	\N	\N	\N	\N
128	juuse-saros	Juuse Saros	G	22	8477424	74	7740000	2033	7	1995-04-19	Forssa, FIN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8477424.png	L	180	\N	FIN	\N	\N	\N	\N
359	john-carlson	John Carlson	D	329	8474590	74	8500000	2028	2	1990-01-10	Natick, Massachusetts, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8474590.png	R	220	D	USA	\N	\N	\N	john-carlson
355	ilya-mikheyev	Ilya Mikheyev	R	32	8481624	95	3850000	2030	4	1994-10-10	Omsk, RUS	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8481624.png	L	192	LW/RW	RUS	\N	\N	\N	\N
559	casey-mittelstadt	Casey Mittelstadt	C	329	8479999	11	5750000	2027	1	1998-11-22	Eden Prairie, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8479999.png	L	205	C	USA	\N	\N	\N	casey-mittelstadt
469	shea-theodore	Shea Theodore	D	36	8477447	27	7425000	2032	6	1995-08-03	Aldergrove, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8477447.png	L	197	D	CAN	\N	\N	\N	\N
367	dennis-hildeby	Dennis Hildeby	G	32	8483710	35	841667	2028	2	2001-08-19	Jarfalla, SWE	6'7"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8483710.png	L	231	\N	SWE	\N	\N	\N	\N
439	luke-schenn	Luke Schenn	D	329	8474568	2	2250000	2027	1	1989-11-02	Saskatoon, Saskatchewan, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8474568.png	R	225	D	CAN	\N	\N	\N	luke-schenn
303	frederick-gaudreau	Frederick Gaudreau	C	329	8477919	89	2100000	2028	2	1993-05-01	Bromont, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8477919.png	R	184	C/RW	CAN	\N	\N	\N	frederick-gaudreau
510	gabriel-vilardi	Gabriel Vilardi	C	38	8480014	13	7500000	2031	5	1999-08-16	Kingston, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8480014.png	R	216	C	CAN	\N	\N	\N	\N
528	chris-kreider	Chris Kreider	L	329	8475184	20	6500000	2027	1	1991-04-30	Boxford, Massachusetts, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8475184.png	L	232	LW/RW	USA	\N	\N	\N	chris-kreider
116	ryan-oreilly	Ryan O'Reilly	C	329	8475158	90	\N	\N	\N	1991-02-07	Clinton, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8475158.png	L	207	C	CAN	\N	\N	\N	ryan-o-reilly
577	josh-doan	Josh Doan	R	9	8482659	91	6950000	2033	7	2002-02-01	Scottsdale, Arizona, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8482659.png	R	198	C/LW/RW	USA	\N	\N	\N	\N
472	adin-hill	Adin Hill	G	36	8478499	33	6250000	2031	5	1996-05-11	Comox, British Columbia, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8478499.png	L	222	\N	CAN	\N	\N	\N	\N
504	adam-lowry	Adam Lowry	C	38	8476392	17	5000000	2031	5	1993-03-29	St. Louis, Missouri, USA	6'5"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8476392.png	L	210	C/LW	USA	\N	\N	\N	\N
475	pierre-luc-dubois	Pierre-Luc Dubois	C	37	8479400	80	8500000	2031	5	1998-06-24	Ste-Agathe-des-Monts, Quebec, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8479400.png	L	220	C/LW	CAN	\N	\N	\N	\N
467	brayden-mcnabb	Brayden McNabb	D	329	8475188	3	3650000	2028	2	1991-01-21	Davidson, Saskatchewan, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8475188.png	L	215	D	CAN	\N	\N	\N	brayden-mcnabb
158	kyle-maclean	Kyle MacLean	C	329	8481237	32	800000	2027	1	1999-04-29	Verona, New Jersey, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8481237.png	L	190	C	USA	\N	\N	\N	kyle-maclean
493	dylan-mcilrath	Dylan McIlrath	D	329	8475795	52	825000	2027	1	1992-04-20	Winnipeg, Manitoba, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8475795.png	R	240	D	CAN	\N	\N	\N	dylan-mcilrath
457	victor-olofsson	Victor Olofsson	R	329	8478109	95	1638330	2027	1	1995-07-18	Ornskoldsvik, SWE	5'11"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8478109.png	L	180	LW/RW	SWE	\N	\N	\N	victor-olofsson
613	jonathan-huberdeau	Jonathan Huberdeau	L	10	8476456	10	10500000	2031	5	1993-06-04	Saint-Jerome, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8476456.png	L	200	LW/RW	CAN	\N	\N	\N	\N
376	matthew-knies	Matthew Knies	L	2	8482720	23	7750000	2031	5	2002-10-17	Phoenix, Arizona, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8482720.png	L	232	LW/RW	USA	\N	\N	\N	\N
334	alexey-toropchenko	Alexey Toropchenko	R	329	8480281	13	2500000	2028	2	1999-06-25	Moscow, RUS	6'6"	https://assets.nhle.com/mugs/nhl/20262027/STL/8480281.png	L	225	LW/RW	RUS	\N	\N	\N	alexey-toropchenko
691	logan-oconnor	Logan O'Connor	R	13	8481186	25	\N	\N	\N	1996-08-14	Missouri City, Texas, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/COL/8481186.png	R	175	C/RW	USA	\N	\N	\N	\N
565	will-borgen	Will Borgen	D	3	8478840	\N	4100000	2030	4	1996-12-19	Moorhead, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8478840.png	R	199	D	USA	\N	\N	\N	\N
386	oliver-ekman-larsson	Oliver Ekman-Larsson	D	329	8475171	95	3500000	2028	2	1991-07-17	Karlskrona, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8475171.png	L	190	D	SWE	\N	\N	\N	oliver-ekman-larsson
571	charlie-mcavoy	Charlie McAvoy	D	3	8479325	73	9500000	2030	4	1997-12-21	Long Beach, New York, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8479325.png	R	211	D	USA	\N	\N	\N	\N
461	rasmus-andersson	Rasmus Andersson	D	36	8478397	4	8500000	2033	7	1996-10-27	Malmo, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8478397.png	R	202	D	SWE	\N	\N	\N	\N
246	helge-grans	Helge Grans	D	329	8482169	3	812500	2027	1	2002-05-10	Ljungby, SWE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8482169.png	R	205	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8805	8805	\N	helge-grans
434	zeev-buium	Zeev Buium	D	35	8484798	24	966500	2027	1	2005-12-07	San Diego, California, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8484798.png	L	183	D	USA	\N	\N	\N	\N
389	darren-raddysh	Darren Raddysh	D	2	8478178	\N	8500000	2034	8	1996-02-28	Toronto, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8478178.png	R	202	D	CAN	\N	\N	\N	\N
626	yan-kuznetsov	Yan Kuznetsov	D	298	8482165	37	812500	2027	1	2002-03-09	Murmansk, RUS	6'4"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8482165.png	L	209	D	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8673	8673	\N	\N
808	carter-verhaeghe	Carter Verhaeghe	C	18	8477409	23	7000000	2033	7	1995-08-14	Toronto, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8477409.png	L	183	LW/RW	CAN	\N	\N	\N	\N
743	miro-heiskanen	Miro Heiskanen	D	329	8480036	4	8450000	2029	3	1999-07-18	Espoo, FIN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8480036.png	L	197	D	FIN	\N	\N	\N	miro-heiskanen
698	cale-makar	Cale Makar	D	329	8480069	8	9000000	2027	1	1998-10-30	Calgary, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/COL/8480069.png	R	187	D	CAN	\N	\N	\N	cale-makar
263	hendrix-lapierre	Hendrix Lapierre	C	28	8482148	\N	1300000	2028	2	2002-02-09	Gatineau, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8482148.png	L	195	C	CAN	\N	\N	\N	\N
600	conor-timmins	Conor Timmins	D	329	8479982	21	2200000	2027	1	1998-09-18	St. Catharines, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8479982.png	R	213	D	CAN	\N	\N	\N	conor-timmins
753	alex-debrincat	Alex DeBrincat	R	329	8479337	93	7875000	2027	1	1997-12-18	Farmington Hills, Michigan, USA	5'8"	https://assets.nhle.com/mugs/nhl/20262027/DET/8479337.png	R	180	LW/RW	USA	\N	\N	\N	alex-debrincat
569	hampus-lindholm	Hampus Lindholm	D	3	8476854	27	6500000	2030	4	1994-01-20	Helsingborg, SWE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8476854.png	L	217	D	SWE	\N	\N	\N	\N
636	jackson-blake	Jackson Blake	R	11	8482809	53	5117002	2034	8	2003-08-03	Fargo, North Dakota, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8482809.png	R	185	RW	USA	\N	\N	\N	\N
662	ryan-greene	Ryan Greene	C	12	8483450	20	950000	2027	1	2003-10-21	St. John's, Newfoundland and Labrador, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8483450.png	R	195	C/RW	CAN	\N	\N	\N	\N
724	jet-greaves	Jet Greaves	G	14	8482982	73	812500	2026	0	2001-03-30	Cambridge, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8482982.png	L	188	\N	CAN	\N	\N	\N	\N
685	parker-kelly	Parker Kelly	C	13	8480448	17	1700000	2030	4	1999-05-14	Camrose, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/COL/8480448.png	L	185	C/LW	CAN	\N	\N	\N	\N
729	matt-duchene	Matt Duchene	C	329	8475168	95	4500000	2029	3	1991-01-16	Haliburton, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8475168.png	L	211	C/RW	CAN	\N	\N	\N	matt-duchene
719	erik-gudbranson	Erik Gudbranson	D	329	8475790	44	1750000	2027	1	1992-01-07	Ottawa, Ontario, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8475790.png	R	222	D	CAN	\N	\N	\N	erik-gudbranson
813	seth-jones	Seth Jones	D	18	8477495	3	9500000	2030	4	1994-10-03	Arlington, Texas, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8477495.png	R	213	D	USA	\N	\N	\N	\N
299	alex-nedeljkovic	Alex Nedeljkovic	G	329	8477968	33	3000000	2028	2	1996-01-07	Parma, Ohio, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8477968.png	L	205	\N	USA	\N	\N	\N	alex-nedeljkovic
767	john-gibson	John Gibson	G	329	8476434	36	6400000	2027	1	1993-07-14	Pittsburgh, Pennsylvania, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DET/8476434.png	L	209	\N	USA	\N	\N	\N	john-gibson
619	ryan-strome	Ryan Strome	C	329	8476458	22	5000000	2027	1	1993-07-11	Mississauga, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8476458.png	R	192	C/RW	CAN	\N	\N	\N	ryan-strome
540	jackson-lacombe	Jackson LaCombe	D	7	8481605	2	9000000	2034	8	2001-01-09	Eden Prairie, Minnesota, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8481605.png	L	208	D	USA	\N	\N	\N	\N
625	joel-hanley	Joel Hanley	D	329	8477810	44	1750000	2027	1	1991-06-08	Keswick, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8477810.png	L	186	D	CAN	\N	\N	\N	joel-hanley
655	brandon-bussi	Brandon Bussi	G	329	8483548	32	1900000	2029	3	1998-06-25	Sound Beach, New York, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8483548.png	R	218	\N	USA	\N	\N	\N	brandon-bussi
642	seth-jarvis	Seth Jarvis	R	11	8482093	24	7420087	2032	6	2002-02-01	Winnipeg, Manitoba, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8482093.png	R	180	C/LW/RW	CAN	\N	\N	\N	\N
711	sean-monahan	Sean Monahan	C	329	8477497	23	5500000	2029	3	1994-10-12	Brampton, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8477497.png	L	206	C	CAN	\N	\N	\N	sean-monahan
802	brad-marchand	Brad Marchand	L	18	8473419	63	5250000	2031	5	1988-05-11	Halifax, Nova Scotia, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8473419.png	L	180	LW/RW	CAN	\N	\N	\N	\N
498	logan-thompson	Logan Thompson	G	37	8480313	48	5850000	2031	5	1997-02-25	Calgary, Alberta, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8480313.png	R	207	\N	CAN	\N	\N	\N	\N
105	samuel-montembeault	Samuel Montembeault	G	21	8478470	35	\N	\N	\N	1996-10-30	Becancour, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8478470.png	L	218	\N	CAN	\N	\N	\N	\N
761	jacob-bryson	Jacob Bryson	D	329	8480196	\N	850000	2027	1	1997-11-18	London, Ontario, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/DET/8480196.png	L	177	D	CAN	\N	\N	\N	jacob-bryson
704	charlie-coyle	Charlie Coyle	C	14	8475745	3	6000000	2032	6	1992-03-02	East Weymouth, Massachusetts, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8475745.png	R	221	C/RW	USA	\N	\N	\N	\N
817	donovan-sebrango	Donovan Sebrango	D	18	8482131	73	850000	2027	1	2002-01-12	Ottawa, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8482131.png	L	223	D	CAN	\N	\N	\N	\N
54	nick-foligno	Nick Foligno	L	329	8473422	71	900000	2027	1	1987-10-31	Buffalo, New York, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8473422.png	L	210	LW/RW	USA	\N	\N	\N	nick-foligno
798	garnet-hathaway	Garnet Hathaway	R	329	8477903	21	2400000	2027	1	1991-11-23	Naples, Florida, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8477903.png	R	212	LW/RW	USA	\N	\N	\N	garnet-hathaway
356	brayden-point	Brayden Point	C	32	8478010	21	9500000	2030	4	1996-03-13	Calgary, Alberta, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8478010.png	R	177	C	CAN	\N	\N	\N	\N
93	alexandre-carrier	Alexandre Carrier	D	329	8478851	45	3750000	2027	1	1996-10-08	Quebec City, Quebec, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8478851.png	R	174	D	CAN	\N	\N	\N	alexandre-carrier
4	leon-draisaitl	Leon Draisaitl	C	1	8477934	29	14000000	2033	7	1995-10-27	Cologne, DEU	6'2"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8477934.png	L	209	C/LW/RW	DEU	\N	\N	\N	\N
205	william-eklund	William Eklund	L	26	8482667	\N	5600000	2029	3	2002-10-12	Stockholm, SWE	5'10"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8482667.png	L	185	C/LW	SWE	\N	\N	\N	\N
631	zach-whitecloud	Zach Whitecloud	D	329	8480727	28	2750000	2028	2	1996-11-28	Brandon, Manitoba, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8480727.png	R	210	D	CAN	\N	\N	\N	zach-whitecloud
650	shayne-gostisbehere	Shayne Gostisbehere	D	329	8476906	4	3200000	2027	1	1993-04-20	Pembroke Pines, Florida, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8476906.png	L	183	D	USA	\N	\N	\N	shayne-gostisbehere
118	ozzy-wiesblatt	Ozzy Wiesblatt	C	329	8482103	89	812500	2027	1	2002-03-09	Calgary, Alberta, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8482103.png	R	183	RW	CAN	\N	\N	\N	ozzy-wiesblatt
115	jonathan-marchessault	Jonathan Marchessault	C	329	8476539	81	5500000	2029	3	1990-12-27	Cap-Rouge, Quebec, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8476539.png	R	185	RW	CAN	\N	\N	\N	jonathan-marchessault
127	justus-annunen	Justus Annunen	G	329	8481020	29	1250000	2028	2	2000-03-11	Kempele, FIN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8481020.png	L	210	\N	FIN	\N	\N	\N	justus-annunen
63	zach-bogosian	Zach Bogosian	D	329	8474567	24	1250000	2027	1	1990-07-15	Massena, New York, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8474567.png	R	231	D	USA	\N	\N	\N	zach-bogosian
313	ryker-evans	Ryker Evans	D	30	8482858	41	2050000	2027	1	2001-12-13	Calgary, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8482858.png	L	195	D	CAN	\N	\N	\N	\N
162	brayden-schenn	Brayden Schenn	C	329	8475170	10	6500000	2028	2	1991-08-22	Saskatoon, Saskatchewan, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8475170.png	L	200	C/LW/RW	CAN	\N	\N	\N	brayden-schenn
736	mikko-rantanen	Mikko Rantanen	R	15	8478420	96	12000000	2033	7	1996-10-29	Nousiainen, FIN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8478420.png	L	228	RW	FIN	\N	\N	\N	\N
123	ilya-lyubushkin	Ilya Lyubushkin	D	329	8480950	\N	3250000	2027	1	1994-04-06	Moscow, RUS	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8480950.png	R	206	D	RUS	\N	\N	\N	ilya-lyubushkin
18	shakir-mukhamadullin	Shakir Mukhamadullin	D	1	8482166	85	1750000	2028	2	2002-01-10	Ufa, RUS	6'4"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8482166.png	L	200	D	RUS	\N	\N	\N	\N
77	jesper-wallstedt	Jesper Wallstedt	G	20	8482661	30	2200000	2027	1	2002-11-14	Vasteras, SWE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8482661.png	L	214	\N	SWE	\N	\N	\N	\N
667	frank-nazar	Frank Nazar	C	12	8483493	91	6599991	2033	7	2004-01-14	Detroit, Michigan, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8483493.png	R	190	C	USA	\N	\N	\N	\N
1	connor-mcdavid	Connor McDavid	C	329	8478402	97	12500000	2028	2	1997-01-13	Richmond Hill, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8478402.png	L	194	C	CAN	\N	\N	\N	connor-mcdavid
85	ivan-demidov	Ivan Demidov	R	21	8484984	93	9150000	2035	9	2005-12-10	Sergiyev Posad, RUS	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8484984.png	L	192	RW	RUS	\N	\N	\N	\N
524	mikael-granlund	Mikael Granlund	C	329	8475798	64	7000000	2028	2	1992-02-26	Oulu, FIN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8475798.png	L	193	C/LW/RW	FIN	\N	\N	\N	mikael-granlund
132	connor-brown	Connor Brown	R	329	8477015	16	3000000	2029	3	1994-01-14	Toronto, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8477015.png	R	184	LW/RW	CAN	\N	\N	\N	connor-brown
141	evan-rodrigues	Evan Rodrigues	C	329	8478542	\N	3018750	2027	1	1993-07-28	Toronto, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8478542.png	R	182	C/LW/RW	CAN	\N	\N	\N	evan-rodrigues
395	daniil-but	Daniil But	F	323	8484388	19	950000	2028	2	2005-02-15	Yaroslavl, RUS	6'5"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8484388.png	R	203	LW	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10664	10664	\N	\N
145	luke-hughes	Luke Hughes	D	23	8482684	43	9000000	2032	6	2003-09-09	Manchester, New Hampshire, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8482684.png	L	198	D	USA	\N	\N	\N	\N
29	samuel-helenius	Samuel Helenius	C	19	8482726	79	875000	2028	2	2002-11-26	Dallas, Texas, USA	6'6"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8482726.png	L	225	C	USA	\N	\N	\N	\N
168	alexander-romanov	Alexander Romanov	D	24	8481014	28	6250000	2033	7	2000-01-06	Moscow, RUS	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8481014.png	L	220	D	RUS	\N	\N	\N	\N
47	anton-forsberg	Anton Forsberg	G	329	8476341	31	2250000	2027	1	1992-11-27	Härnösand, SWE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8476341.png	L	200	\N	SWE	\N	\N	\N	anton-forsberg
13213	tom-nosek	Tom�? Nosek	C	18	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/tom-nosek	\N	\N	\N
258	egor-chinakhov	Egor Chinakhov	R	28	8482475	59	\N	\N	\N	2001-02-01	Omsk, RUS	6'1"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8482475.png	L	203	LW/RW	RUS	\N	\N	\N	\N
489	vincent-desharnais	Vincent Desharnais	D	37	8479576	73	4200000	2030	4	1996-05-29	Laval, Quebec, CAN	6'7"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8479576.png	R	225	D	CAN	\N	\N	\N	\N
380	william-nylander	William Nylander	R	2	8477939	88	11500000	2032	6	1996-05-01	Calgary, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8477939.png	R	200	LW/RW	CAN	\N	\N	\N	\N
264	blake-lizotte	Blake Lizotte	C	329	8481481	46	2250000	2029	3	1997-12-13	Lindstrom, Minnesota, USA	5'9"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8481481.png	L	176	C/LW	USA	\N	\N	\N	blake-lizotte
221	jordan-spence	Jordan Spence	D	26	8481606	10	5000000	2030	4	2001-02-24	Manly, AUS	5'11"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8481606.png	R	188	D	AUS	\N	\N	\N	\N
230	noah-cates	Noah Cates	L	329	8480220	27	4000000	2029	3	1999-02-05	Stillwater, Minnesota, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8480220.png	L	194	LW	USA	\N	\N	\N	noah-cates
471	carter-hart	Carter Hart	G	329	8479394	79	2000000	2027	1	1998-08-13	Sherwood Park, Alberta, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8479394.png	L	196	\N	CAN	\N	\N	\N	carter-hart
428	drew-oconnor	Drew O'Connor	L	329	8482055	18	\N	\N	\N	1998-06-09	Chatham, New Jersey, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8482055.png	L	209	LW/RW	USA	\N	\N	\N	drew-o-connor
314	cale-fleury	Cale Fleury	D	329	8479985	8	890000	2027	1	1998-11-19	Carlyle, Saskatchewan, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8479985.png	R	204	D	CAN	\N	\N	\N	cale-fleury
297	yaroslav-askarov	Yaroslav Askarov	G	29	8482137	30	2000000	2027	1	2002-06-16	Omsk, RUS	6'3"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8482137.png	R	180	\N	RUS	\N	\N	\N	\N
213	shane-pinto	Shane Pinto	C	26	8481596	12	7500000	2030	4	2000-11-12	Franklin Square, New York, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8481596.png	R	206	C	USA	\N	\N	\N	\N
371	max-domi	Max Domi	C	329	8477503	11	3750000	2028	2	1995-03-02	Winnipeg, Manitoba, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8477503.png	L	208	C/LW/RW	CAN	\N	\N	\N	max-domi
388	philippe-myers	Philippe Myers	D	329	8479026	51	850000	2027	1	1997-01-25	Moncton, New Brunswick, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8479026.png	R	221	D	CAN	\N	\N	\N	philippe-myers
329	jake-neighbours	Jake Neighbours	L	31	8482089	63	3750000	2027	1	2002-03-29	Calgary, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/STL/8482089.png	L	201	LW/RW	CAN	\N	\N	\N	\N
346	zemgus-girgensons	Zemgus Girgensons	C	329	8476878	28	875000	2027	1	1994-01-05	Riga, LVA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8476878.png	L	197	C	LVA	\N	\N	\N	zemgus-girgensons
239	porter-martone	Porter Martone	R	27	8485406	94	966667	2028	2	2006-10-26	Peterborough, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8485406.png	R	214	\N	CAN	\N	\N	\N	\N
198	igor-shesterkin	Igor Shesterkin	G	25	8478048	31	11503125	2033	7	1995-12-30	Moscow, RUS	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8478048.png	L	199	\N	RUS	\N	\N	\N	\N
4820	jagger-firkus	Jagger Firkus	F	302	8483442	\N	923333	2027	1	2004-04-29	Irma, Alberta, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8483442.png	R	153	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9755	9755	\N	\N
207	claude-giroux	Claude Giroux	R	329	8473512	28	2000000	2027	1	1988-01-12	Hearst, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8473512.png	R	186	C/LW/RW	CAN	\N	\N	\N	claude-giroux
365	ryan-mcdonagh	Ryan McDonagh	D	329	8474151	27	4100000	2029	3	1989-06-13	St. Paul, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8474151.png	L	216	D	USA	\N	\N	\N	ryan-mcdonagh
322	pavel-buchnevich	Pavel Buchnevich	L	31	8477402	89	8000000	2031	5	1995-04-17	Cherepovets, RUS	6'1"	https://assets.nhle.com/mugs/nhl/20262027/STL/8477402.png	L	196	LW/RW	RUS	\N	\N	\N	\N
250	travis-sanheim	Travis Sanheim	D	27	8477948	6	6250000	2031	5	1996-03-29	Elkhorn, Manitoba, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8477948.png	L	222	D	CAN	\N	\N	\N	\N
337	brandon-carlo	Brandon Carlo	D	329	8478443	\N	4100000	2027	1	1996-11-26	Colorado Springs, Colorado, USA	6'5"	https://assets.nhle.com/mugs/nhl/20262027/STL/8478443.png	R	227	D	USA	\N	\N	\N	brandon-carlo
305	jared-mccann	Jared McCann	L	329	8477955	19	5000000	2027	1	1996-05-31	Stratford, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8477955.png	L	191	C/LW/RW	CAN	\N	\N	\N	jared-mccann
272	samuel-girard	Samuel Girard	D	329	8479398	49	5000000	2027	1	1998-05-12	Roberval, Quebec, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8479398.png	L	170	D	CAN	\N	\N	\N	samuel-girard
289	will-smith	Will Smith	C	29	8484227	2	950000	2027	1	2005-03-17	Boston, Massachusetts, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8484227.png	R	180	C/RW	USA	\N	\N	\N	\N
497	clay-stevenson	Clay Stevenson	G	329	8483532	33	800000	2027	1	1999-03-03	Drayton Valley, Alberta, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8483532.png	L	195	\N	CAN	\N	\N	\N	clay-stevenson
240	matvei-michkov	Matvei Michkov	R	27	8484387	39	950000	2027	1	2004-12-09	Perm, RUS	5'10"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8484387.png	L	172	RW	RUS	\N	\N	\N	\N
447	nic-dowd	Nic Dowd	C	329	8475343	26	3000000	2027	1	1990-05-27	Huntsville, Alabama, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8475343.png	R	195	C/RW	USA	\N	\N	\N	nic-dowd
188	drew-fortescue	Drew Fortescue	D	25	8484169	45	923333	2028	2	2005-04-28	New York, New York, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8484169.png	L	195	\N	USA	\N	\N	\N	\N
810	aaron-ekblad	Aaron Ekblad	D	18	8477932	5	6100000	2033	7	1996-02-07	Windsor, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8477932.png	R	220	D	CAN	\N	\N	\N	\N
426	brendan-gallagher	Brendan Gallagher	R	329	8475848	\N	6500000	2027	1	1992-05-06	Edmonton, Alberta, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8475848.png	R	185	RW	CAN	\N	\N	\N	brendan-gallagher
406	liam-obrien	Liam O'Brien	C	329	8477070	38	\N	\N	\N	1994-07-29	Halifax, Nova Scotia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8477070.png	L	215	C	CAN	\N	\N	\N	liam-o-brien
424	paul-cotter	Paul Cotter	C	329	8481032	\N	2150000	2027	1	1999-11-16	Canton, Michigan, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8481032.png	L	213	C/LW	USA	\N	\N	\N	paul-cotter
5352	dino-kambeitz	Dino Kambeitz	R	295	\N	\N	\N	\N	\N	2000-01-25	\N	6.02	\N	R	212	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8813	8813	\N	\N
732	justin-hryckowian	Justin Hryckowian	C	329	8484829	49	950000	2028	2	2001-02-23	L'Ile-Bizard, Quebec, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8484829.png	L	198	C	CAN	\N	\N	\N	justin-hryckowian
718	dante-fabbro	Dante Fabbro	D	329	8479371	15	4125000	2029	3	1998-06-20	Coquitlam, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8479371.png	R	200	D	CAN	\N	\N	\N	dante-fabbro
623	kevin-bahl	Kevin Bahl	D	10	8480860	7	5350000	2031	5	2000-06-27	New Westminster, British Columbia, CAN	6'6"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8480860.png	L	230	D	CAN	\N	\N	\N	\N
514	josh-morrissey	Josh Morrissey	D	329	8477504	44	6250000	2028	2	1995-03-28	Calgary, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8477504.png	L	195	D	CAN	\N	\N	\N	josh-morrissey
570	mason-lohrei	Mason Lohrei	D	3	8482511	6	3200000	2027	1	2001-01-17	Baton Rouge, Louisiana, USA	6'5"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8482511.png	L	218	D	USA	\N	\N	\N	\N
746	tyler-myers	Tyler Myers	D	329	8474574	57	3000000	2027	1	1990-02-01	Houston, Texas, USA	6'8"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8474574.png	R	229	D	USA	\N	\N	\N	tyler-myers
699	sam-malinski	Sam Malinski	D	13	8484258	70	4750000	2030	4	1998-07-27	Lakeville, Minnesota, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/COL/8484258.png	R	190	D	USA	\N	\N	\N	\N
506	nino-niederreiter	Nino Niederreiter	R	329	8475799	62	4000000	2027	1	1992-09-08	Chur, CHE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8475799.png	L	218	LW/RW	CHE	\N	\N	\N	nino-niederreiter
589	tage-thompson	Tage Thompson	C	9	8479420	72	7142857	2030	4	1997-10-30	Phoenix, Arizona, USA	6'6"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8479420.png	R	220	C/LW/RW	USA	\N	\N	\N	\N
11	ryan-nugent-hopkins	Ryan Nugent-Hopkins	C	329	8476454	93	5125000	2029	3	1993-04-12	Burnaby, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8476454.png	L	192	C/LW	CAN	\N	\N	\N	ryan-nugent-hopkins
663	jordan-greenway	Jordan Greenway	L	329	8478413	\N	4000000	2027	1	1997-02-16	Canton, New York, USA	6'6"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8478413.png	L	231	LW/RW	USA	\N	\N	\N	jordan-greenway
708	ryan-lomberg	Ryan Lomberg	L	329	8479066	94	1300000	2028	2	1994-12-09	Richmond Hill, Ontario, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8479066.png	L	184	LW	CAN	\N	\N	\N	ryan-lomberg
537	drew-helleson	Drew Helleson	D	7	8481563	14	1100000	2027	1	2001-03-26	Farmington, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8481563.png	R	208	D	USA	\N	\N	\N	\N
580	tyson-kozak	Tyson Kozak	C	9	8482896	48	825000	2028	2	2002-12-29	Souris, Manitoba, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8482896.png	L	185	C	CAN	\N	\N	\N	\N
13217	josh-mahura	Josh Mahura	D	329	\N	\N	907500	2027	1	\N	\N	\N	\N	\N	\N	D	\N	https://frozenpool.dobbersports.com/players/josh-mahura	\N	\N	josh-mahura
706	conor-garland	Conor Garland	R	14	8478856	83	6000000	2032	6	1996-03-11	Scituate, Massachusetts, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8478856.png	R	165	LW/RW	USA	\N	\N	\N	\N
801	eetu-luostarinen	Eetu Luostarinen	C	18	8480185	27	5000000	2035	9	1998-09-02	Siilinjarvi, FIN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8480185.png	L	191	C/LW	FIN	\N	\N	\N	\N
556	sean-kuraly	Sean Kuraly	C	329	8476374	52	1850000	2027	1	1993-01-20	Niagara Falls, New York, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8476374.png	L	208	C	USA	\N	\N	\N	sean-kuraly
744	esa-lindell	Esa Lindell	D	15	8476902	23	5250000	2030	4	1994-05-23	Vantaa, FIN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8476902.png	L	217	D	FIN	\N	\N	\N	\N
291	alexander-wennberg	Alexander Wennberg	C	329	8477505	21	6000000	2029	3	1994-09-22	Stockholm, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8477505.png	L	190	C	SWE	\N	\N	\N	alexander-wennberg
254	aleksei-kolosov	Aleksei Kolosov	G	27	8482783	35	850000	2027	1	2002-01-04	Minsk, BLR	6'1"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8482783.png	L	185	\N	BLR	\N	\N	\N	\N
762	ben-chiarot	Ben Chiarot	D	329	8475279	8	3850000	2029	3	1991-05-09	Hamilton, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DET/8475279.png	L	222	D	CAN	\N	\N	\N	ben-chiarot
690	brock-nelson	Brock Nelson	C	329	8475754	11	7500000	2028	2	1991-10-15	Warroad, Minnesota, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/COL/8475754.png	L	205	C/LW	USA	\N	\N	\N	brock-nelson
473	carl-lindbom	Carl Lindbom	G	36	8482761	30	900000	2029	3	2003-05-20	Stockholm, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8482761.png	L	186	\N	SWE	\N	\N	\N	\N
518	connor-hellebuyck	Connor Hellebuyck	G	38	8476945	37	8500000	2031	5	1993-05-19	Commerce, Michigan, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8476945.png	L	207	\N	USA	\N	\N	\N	\N
599	mattias-samuelsson	Mattias Samuelsson	D	9	8480807	23	4285714	2030	4	2000-03-14	Philadelphia, Pennsylvania, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8480807.png	L	229	D	USA	\N	\N	\N	\N
637	william-carrier	William Carrier	L	11	8477478	28	2050000	2030	4	1994-12-20	LaSalle, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8477478.png	L	214	LW	CAN	\N	\N	\N	\N
658	tyler-bertuzzi	Tyler Bertuzzi	L	329	8477479	59	5500000	2028	2	1995-02-24	Sudbury, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8477479.png	L	200	LW/RW	CAN	\N	\N	\N	tyler-bertuzzi
547	laurent-brossoit	Laurent Brossoit	G	329	8476316	\N	1100000	2027	1	1993-03-23	Port Alberni, British Columbia, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8476316.png	L	203	\N	CAN	\N	\N	\N	laurent-brossoit
248	hunter-mcdonald	Hunter Mcdonald	D	310	8483760	75	950000	2026	0	2002-05-11	Fairport, New York, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8483760.png	L	238	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10046	10046	\N	\N
726	jamie-benn	Jamie Benn	L	329	8473994	14	850000	2027	1	1989-07-18	Victoria, British Columbia, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8473994.png	L	210	C/LW	CAN	\N	\N	\N	jamie-benn
629	brayden-pachal	Brayden Pachal	D	329	8481167	94	1187500	2027	1	1999-08-23	Estevan, Saskatchewan, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8481167.png	R	202	D	CAN	\N	\N	\N	brayden-pachal
4843	matej-blumel	Matej Blumel	L	329	8481712	\N	875000	2026	0	2000-05-31	Tabor, CZE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8481712.png	L	202	LW/RW	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9533	9533	\N	matej-blumel
114	alexander-kerfoot	Alexander Kerfoot	C	22	8477021	\N	\N	\N	\N	1994-08-11	Vancouver, British Columbia, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8477021.png	L	185	C	CAN	\N	\N	\N	\N
59	maksim-shabanov	Maksim Shabanov	R	20	8485702	49	\N	\N	\N	2000-10-07	Chelyabinsk, RUS	5'9"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8485702.png	L	167	RW	RUS	\N	\N	\N	\N
5121	kevin-lombardi	Kevin Lombardi	F	316	\N	\N	\N	\N	\N	1998-08-12	\N	6.05	\N	R	229	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10033	10033	\N	\N
5262	alex-doucet	Alex Doucet	L	304	\N	\N	\N	\N	\N	2002-01-12	\N	6.00	\N	L	195	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10008	10008	\N	\N
4850	jake-lucchini	Jake Lucchini	C	312	8481422	\N	\N	\N	\N	1995-05-09	Trail, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8481422.png	L	180	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7512	7512	\N	\N
5305	jon-mcdonald	Jon Mcdonald	D	307	\N	\N	\N	\N	\N	1998-06-15	\N	6.00	\N	L	181	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9820	9820	\N	\N
5247	dmitry-kuzmin	Dmitry Kuzmin	D	329	\N	\N	820000	2026	0	2003-04-23	\N	5'10	\N	L	188	\N	BLR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9739	9739	\N	dmitry-kuzmin
4795	jakob-pelletier	Jakob Pelletier	L	329	8481592	\N	825000	2028	2	2001-03-07	Quebec City, Quebec, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8481592.png	L	172	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8744	8744	\N	jakob-pelletier
688	nathan-mackinnon	Nathan MacKinnon	C	13	8477492	29	12600000	2031	5	1995-09-01	Halifax, Nova Scotia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/COL/8477492.png	R	200	C/RW	CAN	\N	\N	\N	\N
5233	logan-brown	Logan Brown	F	329	\N	\N	775000	2026	0	1998-03-05	\N	6'7	\N	L	229	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7362	7362	\N	logan-brown
5257	nikita-nesterenko	Nikita Nesterenko	L	317	8481754	\N	812500	2027	1	2001-09-10	Brooklyn, New York, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8481754.png	L	203	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9778	9778	\N	\N
5187	riley-duran	Riley Duran	R	329	8482213	\N	850000	2027	1	2002-01-25	Boston, Massachusetts, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8482213.png	R	198	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10055	10055	\N	riley-duran
333	robert-thomas	Robert Thomas	C	31	8480023	18	8125000	2031	5	1999-07-02	Aurora, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/STL/8480023.png	R	207	C/RW	CAN	\N	\N	\N	\N
5269	justin-holl	Justin Holl	D	329	8475718	\N	900000	2027	1	1992-01-30	Tonka Bay, Minnesota, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/DET/8475718.png	R	194	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5824	5824	\N	justin-holl
5251	joe-fleming	Joe Fleming	F	306	8483829	\N	850000	2027	1	2003-06-19	Wellesley, Massachusetts, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8483829.png	R	211	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9279	9279	\N	\N
584	ryan-mcleod	Ryan McLeod	C	329	8480802	71	5000000	2029	3	1999-09-21	Mississauga, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8480802.png	L	204	C/LW/RW	CAN	\N	\N	\N	ryan-mcleod
5223	riley-stillman	Riley Stillman	D	329	8479388	\N	812500	2027	1	1998-03-09	Peterborough, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8479388.png	L	207	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7352	7352	\N	riley-stillman
5230	carter-mazur	Carter Mazur	R	304	8482802	\N	875000	2028	2	2002-03-28	Jackson, Michigan, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/DET/8482802.png	R	200	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9661	9661	\N	\N
4833	john-leonard	John Leonard	L	329	8481077	\N	850000	2027	1	1998-08-07	Westwood, New Jersey, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/DET/8481077.png	L	192	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8511	8511	\N	john-leonard
5242	ville-ottavainen	Ville Ottavainen	D	302	8482866	\N	850000	2027	1	2002-08-12	Oulu, FIN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8482866.png	R	210	D	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9706	9706	\N	\N
5254	matt-benning	Matt Benning	D	329	8476988	\N	1250000	2026	0	1994-05-25	Edmonton, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8476988.png	R	220	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6510	6510	\N	matt-benning
176	pavel-dorofeyev	Pavel Dorofeyev	R	25	8481604	16	11000000	2033	7	2000-10-26	Nizhny Tagil, RUS	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8481604.png	L	194	LW/RW	RUS	\N	\N	\N	\N
5228	austin-strand	Austin Strand	D	324	8480467	\N	750000	2023	0	1997-02-17	Calgary, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8480467.png	R	215	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7117	7117	\N	\N
5197	hunter-skinner	Hunter Skinner	D	319	8481715	\N	850000	2027	1	2001-04-29	Wyandotte, Michigan, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/STL/8481715.png	R	195	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8630	8630	\N	\N
717	jake-christiansen	Jake Christiansen	D	329	8481161	2	975000	2027	1	1999-09-12	West Vancouver, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8481161.png	L	199	D	CAN	\N	\N	\N	jake-christiansen
5221	noah-gregor	Noah Gregor	C	329	8479393	\N	850000	2027	1	1998-07-28	Beaumont, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8479393.png	L	201	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7149	7149	\N	noah-gregor
4866	ryan-suzuki	Ryan Suzuki	C	300	8481576	\N	850000	2027	1	2001-05-28	London, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8481576.png	L	185	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8437	8437	\N	\N
4854	ben-hemmerling	Ben Hemmerling	F	306	8483748	\N	844167	2027	1	2004-04-21	Edmonton, Alberta, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8483748.png	R	177	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9272	9272	\N	\N
4916	artem-shlaine	Artem Shlaine	F	321	8482214	\N	952500	2027	1	2002-03-07	Moscow, RUS	6'1"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8482214.png	L	165	C	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10546	10546	\N	\N
5200	jeremie-poirier	Jeremie Poirier	D	329	\N	\N	775000	2026	0	2002-06-02	\N	6'1	\N	L	196	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9447	9447	\N	jeremie-poirier
4836	alex-nylander	Alex Nylander	R	322	8479423	\N	\N	\N	\N	1998-03-02	Calgary, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8479423.png	R	205	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6489	6489	\N	\N
4910	phil-tomasino	Phil Tomasino	R	310	\N	\N	\N	\N	\N	2001-07-28	\N	6.00	https://www.hockeydb.com/ihdb/photos/philip-tomasino-2026-50.jpg	R	187	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8559	8559	\N	\N
4940	cooper-marody	Cooper Marody	F	302	8478442	\N	\N	\N	\N	1996-12-20	Brighton, Michigan, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8478442.png	R	184	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7132	7132	\N	\N
5031	nikita-pavlychev	Nikita Pavlychev	C	300	8478914	\N	\N	\N	\N	1997-03-23	Yaroslavl, RUS	6'7"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8478914.png	L	200	C	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8615	8615	\N	\N
4986	robert-mastrosimone	Robert Mastrosimone	L	299	8481561	\N	\N	\N	\N	2001-01-24	Bay Shore, New York, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8481561.png	L	170	C/LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9914	9914	\N	\N
5730	davis-burnside	Davis Burnside	F	311	\N	\N	\N	\N	\N	2003-09-22	\N	6.00	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11041	11041	\N	\N
4839	sean-farrell	Sean Farrell	F	309	8482081	\N	775000	2026	0	2001-11-02	Milford, Massachusetts, USA	5'9"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8482081.png	L	182	C/LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9791	9791	\N	\N
4817	viljami-marjala	Viljami Marjala	C	296	8482759	\N	910000	2027	1	2003-01-29	Oulu, FIN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8482759.png	L	178	C	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10876	10876	\N	\N
4870	roby-jarventie	Roby Jarventie	R	296	8482162	\N	775000	2026	0	2002-08-08	Tampere, FIN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8482162.png	L	184	LW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8726	8726	\N	\N
4797	alex-barre-boulet	Alex Barre-boulet	C	329	8479718	\N	875000	2028	2	1997-05-21	Montmagny, Quebec, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/COL/8479718.png	L	178	C/LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7345	7345	\N	\N
4819	dylan-duke	Dylan Duke	C	320	8482663	\N	892500	2027	1	2003-03-04	Strongsville, Ohio, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8482663.png	L	184	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10148	10148	\N	\N
5016	isaak-phillips	Isaak Phillips	D	329	8482192	\N	812500	2027	1	2001-09-28	Barrie, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8482192.png	L	205	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8424	8424	\N	isaak-phillips
430	elias-pettersson	Elias Pettersson	D	295	8483678	25	11600000	2032	6	2004-02-16	Vasteras, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8483678.png	L	185	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10027	10027	\N	\N
4813	luca-del-bel-belluz	Luca Del Bel Belluz	F	301	8483432	\N	923333	2027	1	2003-11-10	Woodbridge, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8483432.png	L	185	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9981	9981	\N	\N
4944	jack-williams	Jack Williams	C	329	8485469	\N	875000	2028	2	2002-03-02	Biddeford, Maine, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8485469.png	R	185	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10894	10894	\N	jack-williams
4852	rem-pitlick	Rem Pitlick	L	316	8479514	\N	1100000	2024	0	1997-04-02	Ottawa, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8479514.png	L	186	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7927	7927	\N	\N
4842	jack-ahcan	Jack Ahcan	D	329	8482072	\N	875000	2028	2	1997-05-18	Savage, Minnesota, USA	5'8"	https://assets.nhle.com/mugs/nhl/20262027/COL/8482072.png	L	180	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8500	8500	\N	jack-ahcan
4903	justin-bailey	Justin Bailey	R	317	8477473	\N	775000	2025	0	1995-07-01	Buffalo, New York, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8477473.png	R	214	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6080	6080	\N	\N
4913	xavier-parent	Xavier Parent	F	324	8483841	\N	850000	2027	1	2001-03-23	Laval, Quebec, CAN	5'8"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8483841.png	L	170	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9516	9516	\N	\N
4883	brett-leason	Brett Leason	R	329	8481517	\N	850000	2027	1	1999-04-30	Calgary, Alberta, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8481517.png	R	220	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7921	7921	\N	brett-leason
4862	ben-steeves	Ben Steeves	F	329	8484834	\N	850000	2027	1	2002-05-10	Bedford, New Hampshire, USA	5'8"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8484834.png	L	165	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10056	10056	\N	ben-steeves
5014	dysin-mayo	Dysin Mayo	D	329	8478062	\N	775000	2026	0	1996-08-17	Victoria, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8478062.png	R	190	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6322	6322	\N	dysin-mayo
5018	joakim-kemell	Joakim Kemell	F	312	8483465	\N	950000	2027	1	2004-04-27	Jyvaskyla, FIN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8483465.png	R	182	RW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9631	9631	\N	\N
5026	aatu-jamsen	Aatu Jamsen	F	313	8482466	\N	850000	2027	1	2002-07-22	Lahti, FIN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8482466.png	L	154	RW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9241	9241	\N	\N
4908	egor-afanasyev	Egor Afanasyev	L	329	\N	\N	800000	2026	0	2001-01-23	\N	6'4	\N	L	211	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8914	8914	\N	egor-afanasyev
5033	reid-schaefer	Reid Schaefer	L	312	8483513	\N	950000	2027	1	2003-09-21	Edmonton, Alberta, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8483513.png	L	226	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9876	9876	\N	\N
4958	matyas-sapovaliv	Matyas Sapovaliv	F	306	8483511	\N	860000	2027	1	2004-02-12	Prague, CZE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8483511.png	L	204	C	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9274	9274	\N	\N
4968	oscar-fisker-m-lgaard	OSCAR FISKER MøLGAARD	F	302	\N	\N	\N	\N	\N	2005-02-18	\N	6'0	\N	L	168	\N	DNK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10575	10575	\N	\N
4992	daniel-carr	Daniel Carr	L	312	\N	\N	\N	\N	\N	1991-11-01	\N	6'0	\N	L	186	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5671	5671	\N	\N
5064	matthew-barbolini	Matthew Barbolini	F	322	\N	\N	\N	\N	\N	2000-06-01	\N	6'2	\N	R	188	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10053	10053	\N	\N
5089	trevor-carrick	Trevor Carrick	D	299	8476953	\N	\N	\N	\N	1994-07-04	Stouffville, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8476953.png	L	209	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5614	5614	\N	\N
4962	ty-nelson	Ty Nelson	D	302	8483494	\N	867500	2027	1	2004-03-30	Toronto, Ontario, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8483494.png	R	195	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9764	9764	\N	\N
5058	jagger-joshua	Jagger Joshua	L	329	8484248	\N	875000	2028	2	1999-03-29	Dearborn, Michigan, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8484248.png	L	201	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9643	9643	\N	jagger-joshua
4960	owen-sillinger	Owen Sillinger	C	329	8483538	\N	850000	2027	1	1997-09-23	Regina, Saskatchewan, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8483538.png	L	182	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9058	9058	\N	owen-sillinger
4933	sandis-vilmanis	Sandis Vilmanis	F	299	8483771	\N	925000	2029	3	2004-01-23	Riga, LVA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8483771.png	L	192	LW/RW	LVA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10456	10456	\N	\N
4919	dominik-shine	Dominik Shine	F	329	8479942	\N	875000	2028	2	1993-04-18	Pinckney, Michigan, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/DET/8479942.png	R	177	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6627	6627	\N	dominik-shine
4879	joshua-roy	Joshua Roy	L	309	8482749	\N	850000	2027	1	2003-08-06	Saint-Georges-De-Beauce, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8482749.png	L	192	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9182	9182	\N	\N
5137	jake-leschyshyn	Jake Leschyshyn	C	329	8479991	\N	775000	2026	0	1999-03-10	Raleigh, North Carolina, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8479991.png	L	196	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7622	7622	\N	jake-leschyshyn
5132	ben-gleason	Ben Gleason	D	329	8479416	\N	800000	2026	0	1998-03-25	Ortonville, Michigan, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8479416.png	L	190	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7375	7375	\N	ben-gleason
5133	cedric-pare	Cedric Pare	F	322	8480249	\N	775000	2025	0	1999-01-24	Levis, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8480249.png	L	205	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7780	7780	\N	\N
5069	samuel-savoie	Samuel Savoie	F	316	8483677	\N	878333	2027	1	2004-03-25	Dieppe, New Brunswick, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8483677.png	L	189	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10177	10177	\N	\N
4838	cole-guttman	Cole Guttman	F	329	8480252	\N	812500	2027	1	1999-04-06	Northridge, California, USA	5'9"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8480252.png	R	167	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9357	9357	\N	cole-guttman
5004	brayden-yager	Brayden Yager	C	311	8484242	\N	950000	2028	2	2005-01-03	Saskatoon, Saskatchewan, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8484242.png	R	180	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10908	10908	\N	\N
5130	aidan-thompson	Aidan Thompson	F	305	8483685	\N	907500	2027	1	2002-02-18	Fort Collins, Colorado, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8483685.png	L	180	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10618	10618	\N	\N
5139	joey-abate	Joey Abate	L	314	8483652	\N	775000	2024	0	1998-09-26	Bloomingdale, Illinois, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8483652.png	L	198	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9435	9435	\N	\N
5087	riley-heidt	Riley Heidt	C	308	8484178	\N	950000	2028	2	2005-03-25	Saskatoon, Saskatchewan, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8484178.png	L	178	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10608	10608	\N	\N
5045	topias-vilen	Topias Vilen	D	324	8482873	\N	859167	2026	0	2003-04-01	Lahti, FIN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8482873.png	L	194	D	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9758	9758	\N	\N
5040	ian-mitchell	Ian Mitchell	D	329	8480070	\N	775000	2026	0	1999-01-18	St. Albert, Alberta, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8480070.png	R	198	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8667	8667	\N	ian-mitchell
5078	jack-thompson	Jack Thompson	D	295	8482144	\N	850000	2027	1	2002-03-19	Courtice, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8482144.png	R	189	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8709	8709	\N	\N
4946	jaret-anderson-dolan	Jaret Anderson-dolan	C	329	8479994	\N	775000	2026	0	1999-09-12	Calgary, Alberta, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8479994.png	L	200	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7118	7118	\N	jaret-anderson-dolan
4980	danil-gushchin	Danil Gushchin	F	329	\N	\N	775000	2026	0	2002-02-06	\N	5'8	\N	L	165	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9127	9127	\N	danil-gushchin
5277	theo-lindstein	Theo Lindstein	D	319	8484188	\N	950000	2028	2	2005-01-05	Gavle, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/STL/8484188.png	L	197	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10920	10920	\N	\N
4885	michael-brandsegg-nygard	Michael Brandsegg-nygard	R	304	8484794	\N	975000	2028	2	2005-10-05	Oslo, NOR	6'1"	https://assets.nhle.com/mugs/nhl/20262027/DET/8484794.png	R	204	RW	NOR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10629	10629	\N	\N
5085	lenni-hameenaho	Lenni Hameenaho	F	324	8484177	\N	950000	2028	2	2004-11-07	Kajaani, FIN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8484177.png	R	195	RW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10892	10892	\N	\N
5390	bryan-yoon	Bryan Yoon	D	303	8484741	\N	\N	\N	\N	1998-01-27	Parker, Colorado, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/COL/8484741.png	R	172	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10012	10012	\N	\N
5376	jack-malone	Jack Malone	F	324	8481731	\N	\N	\N	\N	2000-10-13	Danville, California, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8481731.png	R	191	C/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10158	10158	\N	\N
5344	tate-singleton	Tate Singleton	R	301	8484383	\N	\N	\N	\N	1998-09-05	West Lebanon, New Hampshire, USA	5'9"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8484383.png	L	176	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9904	9904	\N	\N
5374	ian-mckinnon	Ian Mckinnon	F	302	8482616	\N	\N	\N	\N	1998-03-05	Whitby, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8482616.png	L	194	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8625	8625	\N	\N
5362	mitchell-vande-sompel	Mitchell Vande Sompel	D	299	8478481	\N	\N	\N	\N	1997-02-11	London, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8478481.png	L	190	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6840	6840	\N	\N
5371	chas-sharpe	Chas Sharpe	D	322	\N	\N	\N	\N	\N	2003-11-28	\N	6.03	\N	R	204	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10144	10144	\N	\N
5094	corson-ceulemans	Corson Ceulemans	D	301	8482678	\N	850000	2027	1	2003-05-05	Regina, Saskatchewan, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8482678.png	R	198	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9618	9618	\N	\N
5111	brennan-othmann	Brennan Othmann	L	298	8482747	\N	925000	2026	0	2003-01-05	Pickering, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8482747.png	L	192	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9970	9970	\N	\N
5109	tristan-bertucci	Tristan Bertucci	D	321	8484146	\N	878333	2028	2	2005-07-12	Woodbridge, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8484146.png	L	191	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10135	10135	\N	\N
5076	dylan-roobroeck	Dylan Roobroeck	F	305	8484461	\N	875000	2027	1	2004-07-27	London, Ontario, CAN	6'7"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8484461.png	L	222	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10189	10189	\N	\N
5125	shane-lachance	Shane Lachance	F	324	8482941	\N	933750	2027	1	2003-08-30	Andover, Massachusetts, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8482941.png	L	195	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10632	10632	\N	\N
5282	artem-duda	Artem Duda	D	323	\N	\N	950000	2027	1	2004-04-08	\N	6'1	\N	L	187	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10218	10218	\N	\N
5339	nate-clurman	Nate Clurman	D	329	\N	\N	775000	2026	0	1998-05-08	\N	6.02	\N	R	202	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8689	8689	\N	nate-clurman
5294	mathieu-cataford	Mathieu Cataford	F	306	8484155	\N	855000	2028	2	2005-03-01	Chateaugay, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8484155.png	R	200	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10131	10131	\N	\N
5314	ryan-mcgregor	Ryan Mcgregor	C	323	8480248	\N	775000	2024	0	1999-01-29	Burlington, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8480248.png	L	168	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7581	7581	\N	\N
5320	alec-regula	Alec Regula	D	329	8480831	\N	812500	2027	1	2000-08-06	West Bloomfield, Michigan, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8480831.png	R	211	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7663	7663	\N	alec-regula
5395	elias-salomonsson	Elias Salomonsson	D	311	8483510	\N	870000	2027	1	2004-08-31	Skelleftea, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8483510.png	R	172	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10448	10448	\N	\N
5241	viliam-kmec	Viliam Kmec	D	306	8485138	\N	858333	2027	1	2004-01-02	Kosice, SVK	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8485138.png	R	206	D	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10285	10285	\N	\N
5337	michael-pezzetta	Michael Pezzetta	L	329	8479543	\N	812500	2027	1	1998-03-13	Toronto, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8479543.png	L	222	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7383	7383	\N	michael-pezzetta
5401	mackenzie-maceachern	Mackenzie Maceachern	L	329	8476907	\N	812500	2027	1	1994-03-09	Bloomfield Hills, Michigan, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8476907.png	L	193	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6462	6462	\N	mackenzie-maceachern
5366	samu-tuomaala	Samu Tuomaala	F	329	8482727	\N	892500	2026	0	2003-01-08	Oulu, FIN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8482727.png	R	174	RW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8777	8777	\N	samu-tuomaala
4804	quinn-hutson	Quinn Hutson	F	296	8485511	\N	875000	2028	2	2002-01-01	North Barrington, Illinois, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8485511.png	R	176	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10874	10874	\N	\N
5330	kevin-gravel	Kevin Gravel	D	329	8475857	\N	775000	2026	0	1992-03-06	Kingsford, Michigan, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8475857.png	L	205	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5529	5529	\N	kevin-gravel
5309	marek-alscher	Marek Alscher	D	299	8483687	\N	896667	2027	1	2004-04-07	Slany, CZE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8483687.png	L	206	D	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9745	9745	\N	\N
5300	bradley-marek	Bradley Marek	F	329	8484566	\N	790000	2026	0	2000-11-13	Big Rapids, Michigan, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8484566.png	L	212	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9799	9799	\N	bradley-marek
5239	ryan-chesley	Ryan Chesley	D	307	8483430	\N	923333	2028	2	2004-02-27	St. Paul, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8483430.png	R	195	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10572	10572	\N	\N
5406	sam-lipkin	Sam Lipkin	F	323	8482924	\N	876667	2027	1	2003-01-03	Philadelphia, Pennsylvania, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8482924.png	L	192	C/LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10111	10111	\N	\N
5060	jonathan-gruden	Jonathan Gruden	C	329	\N	\N	775000	2026	0	2000-05-04	\N	6'0	\N	L	192	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7608	7608	\N	jonathan-gruden
5458	shawn-element	Shawn Element	L	312	8482842	\N	\N	\N	\N	2000-04-23	Victoriaville, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8482842.png	L	192	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8837	8837	\N	\N
5527	alex-gallant	Alex Gallant	L	298	8479176	\N	\N	\N	\N	1992-12-08	Summerside, Prince Edward Island, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8479176.png	L	185	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6142	6142	\N	\N
5412	carson-bantle	Carson Bantle	L	304	8482490	\N	\N	\N	\N	2002-01-22	Onalaska, Wisconsin, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/DET/8482490.png	L	210	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10476	10476	\N	\N
5450	kenta-isogai	Kenta Isogai	F	313	8485215	\N	\N	\N	\N	2004-08-28	Nagano, JPN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8485215.png	L	177	LW	JPN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10703	10703	\N	\N
5521	sam-stange	Sam Stange	F	319	8482129	\N	\N	\N	\N	2001-04-20	Eau Claire, Wisconsin, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/STL/8482129.png	R	216	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10841	10841	\N	\N
5418	dmitry-osipov	Dmitry Osipov	D	324	\N	\N	\N	\N	\N	1996-10-04	\N	6'4	\N	R	230	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6879	6879	\N	\N
5456	red-savage	Red Savage	C	315	\N	\N	\N	\N	\N	2003-05-15	\N	5.11	\N	L	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10926	10926	\N	\N
5485	sloan-stanick	Sloan Stanick	F	306	\N	\N	\N	\N	\N	2003-08-01	\N	5.10	\N	L	171	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10286	10286	\N	\N
5432	sam-bitten	Sam Bitten	L	307	\N	\N	\N	\N	\N	2000-03-21	\N	6.02	\N	L	220	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9881	9881	\N	\N
13229	alex-barr-boulet	Alex Barr�-Boulet	F	13	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/alex-barr-boulet	\N	\N	\N
5632	zack-hayes	Zack Hayes	D	312	8481849	\N	\N	\N	\N	1999-04-24	Calgary, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8481849.png	L	224	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7698	7698	\N	\N
5576	ryan-kirwan	Ryan Kirwan	L	322	8485488	\N	\N	\N	\N	2002-02-27	Dewitt, New York, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8485488.png	L	205	LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10551	10551	\N	\N
5494	anri-ravinskis	Anri Ravinskis	L	295	8483110	\N	910000	2027	1	2003-01-02	Riga, LVA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8483110.png	L	186	LW	LVA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10919	10919	\N	\N
5487	tyrel-bauer	Tyrel Bauer	D	311	8482459	\N	775000	2026	0	2002-03-23	Calgary, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8482459.png	R	207	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9555	9555	\N	\N
5434	stanislav-svozil	Stanislav Svozil	D	329	8482711	\N	870000	2026	0	2003-01-17	Prerov, CZE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8482711.png	L	192	D	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9735	9735	\N	stanislav-svozil
5503	connor-clattenburg	Connor Clattenburg	L	296	8484529	\N	855000	2028	2	2005-05-02	Ottawa, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8484529.png	L	215	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10595	10595	\N	\N
5513	kalle-vaisanen	Kalle Vaisanen	F	305	8482868	\N	888333	2027	1	2003-01-28	Kotka, FIN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8482868.png	R	200	LW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10123	10123	\N	\N
5443	gavin-brindley	Gavin Brindley	R	303	8484149	\N	875000	2028	2	2004-10-05	Fort Myers, Florida, USA	5'8"	https://assets.nhle.com/mugs/nhl/20262027/COL/8484149.png	R	173	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10481	10481	\N	\N
5426	leon-muggli	Leon Muggli	D	307	8484772	\N	940833	2029	3	2006-07-09	Cham, CHE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8484772.png	L	165	D	CHE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10592	10592	\N	\N
5498	bryce-montgomery	Bryce Montgomery	D	300	8482888	\N	854910	2027	1	2002-11-12	Washington, District of Columbia, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8482888.png	R	220	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10182	10182	\N	\N
5424	justin-ertel	Justin Ertel	L	321	8482919	\N	892500	2027	1	2003-05-27	Kitchener, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8482919.png	L	191	LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10451	10451	\N	\N
5508	eriks-mateiko	Eriks Mateiko	C	307	8484775	\N	889167	2029	3	2005-11-18	Jelgava, LVA	6'5"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8484775.png	L	208	C	LVA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10866	10866	\N	\N
5611	navrin-mutter	Navrin Mutter	L	329	8481817	\N	850000	2027	1	2001-03-15	London, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8481817.png	L	202	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7722	7722	\N	navrin-mutter
5452	leo-loof	Leo Loof	D	319	8482478	\N	867500	2026	0	2002-04-25	Karlstad, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/STL/8482478.png	L	201	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9862	9862	\N	\N
5440	dylan-hryckowian	Dylan Hryckowian	F	321	\N	\N	1013750	2028	2	2004-05-19	\N	5'10	\N	R	180	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10999	10999	\N	\N
5354	jackson-dorrington	Jackson Dorrington	D	305	\N	\N	901667	2028	2	2004-04-13	\N	6'3	\N	L	216	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10523	10523	\N	\N
5359	joseph-labate	Joseph Labate	C	329	8476425	\N	775000	2026	0	1993-04-16	Burnsville, Minnesota, USA	6'5"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8476425.png	L	225	C/LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5882	5882	\N	joseph-labate
5565	milo-roelens	Milo Roelens	C	320	8483921	\N	895000	2027	1	2003-01-16	Roeselare, BEL	6'7"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8483921.png	L	225	C/LW	BEL	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10165	10165	\N	\N
5559	lucas-wahlin	Lucas Wahlin	F	311	8486141	\N	910000	2027	1	2001-05-03	USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8486141.png	\N	170	LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11040	11040	\N	\N
5480	massimo-rizzo	Massimo Rizzo	F	329	8481760	\N	925000	2026	0	2001-06-13	Burnaby, British Columbia, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8481760.png	L	175	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10166	10166	\N	massimo-rizzo
5636	austin-brimmer	Austin Brimmer	R	295	8486021	\N	\N	\N	\N	2001-08-10	Markham, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8486021.png	R	223	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10973	10973	\N	\N
5625	tyler-inamoto	Tyler Inamoto	D	296	\N	\N	\N	\N	\N	1999-05-06	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9117	9117	\N	\N
5594	hank-kempf	Hank Kempf	D	303	8482950	\N	\N	\N	\N	2002-04-15	Wilmette, Illinois, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/COL/8482950.png	L	190	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10588	10588	\N	\N
5634	aiden-hansen-bukata	Aiden Hansen-bukata	D	303	\N	\N	\N	\N	\N	1999-06-29	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10580	10580	\N	\N
5642	case-mccarthy	Case Mccarthy	D	305	8481566	\N	\N	\N	\N	2001-01-09	Troy, New York, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8481566.png	R	198	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10154	10154	\N	\N
5647	christopher-douglas	Christopher Douglas	R	315	\N	\N	\N	\N	\N	2000-07-06	\N	6.02	\N	R	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10977	10977	\N	\N
5630	yanick-turcotte	Yanick Turcotte	L	300	\N	\N	\N	\N	\N	0000-00-00	\N	6.00	\N	L	203	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6937	6937	\N	\N
5601	justin-janicke	Justin Janicke	F	302	\N	\N	\N	\N	\N	2003-06-30	\N	5'11	\N	L	189	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10548	10548	\N	\N
5619	ryland-mosley	Ryland Mosley	L	316	\N	\N	\N	\N	\N	2000-02-15	\N	5'11	\N	R	195	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10500	10500	\N	\N
5608	max-grondin	Max Grondin	C	320	\N	\N	\N	\N	\N	2000-07-04	\N	6.04	\N	L	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10986	10986	\N	\N
5761	kienan-draper	Kienan Draper	R	304	8482521	\N	\N	\N	\N	2002-02-19	Royal Oak, Michigan, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/DET/8482521.png	R	187	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11076	11076	\N	\N
5737	erik-bargholtz	Erik Bargholtz	F	318	\N	\N	\N	\N	\N	2001-04-12	\N	6.01	\N	R	203	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11002	11002	\N	\N
5742	gavin-hain	Gavin Hain	C	305	8481057	\N	\N	\N	\N	2000-04-03	Grand Rapids, Minnesota, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8481057.png	L	194	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9857	9857	\N	\N
5760	kevin-wall	Kevin Wall	R	319	8481756	\N	\N	\N	\N	2000-02-01	Rochester, New York, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/STL/8481756.png	R	188	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9878	9878	\N	\N
5659	jackson-berezowski	Jackson Berezowski	C	302	8483825	\N	\N	\N	\N	2002-02-12	Yorkton, Saskatchewan, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8483825.png	R	185	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9903	9903	\N	\N
5554	josh-bloom	Josh Bloom	L	329	8482865	\N	859167	2026	0	2003-06-08	Oakville, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8482865.png	L	182	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9135	9135	\N	josh-bloom
5547	jack-anderson	Jack Anderson	D	321	8486126	\N	1050000	2028	2	2002-11-14	USA	6'6"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8486126.png	\N	225	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10989	10989	\N	\N
5592	felix-trudeau	Felix Trudeau	F	319	8486134	\N	1013750	2028	2	2002-09-24	CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/STL/8486134.png	L	190	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11008	11008	\N	\N
5533	cade-webber	Cade Webber	D	329	8481570	\N	825000	2027	1	2001-01-05	Worcester, Massachusetts, USA	6'7"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8481570.png	L	212	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10426	10426	\N	cade-webber
4826	martin-chromiak	Martin Chromiak	F	313	8482160	\N	850000	2027	1	2002-08-20	Ilava, SVK	6'0"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8482160.png	R	187	LW/RW	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8714	8714	\N	\N
5692	samuel-laberge	Samuel Laberge	F	329	8478956	\N	775000	2026	0	1997-04-10	Chateauguay, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8478956.png	L	206	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6859	6859	\N	samuel-laberge
5542	eddie-genborg	Eddie Genborg	F	304	\N	\N	997500	2029	3	2007-04-20	\N	6'1	\N	L	179	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10982	10982	\N	\N
5556	kaleb-lawrence	Kaleb Lawrence	C	315	\N	\N	877500	2027	1	2003-01-10	\N	6'7	\N	L	230	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9245	9245	\N	\N
5574	roger-mcqueen	Roger Mcqueen	C	317	\N	\N	1075000	2029	3	2006-10-02	\N	6'5	\N	R	197	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11036	11036	\N	\N
5540	dylan-wendt	Dylan Wendt	F	329	8484916	\N	870000	2026	0	2001-01-09	Grand Haven, Michigan, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8484916.png	R	195	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10107	10107	\N	dylan-wendt
5627	vinzenz-rohrer	Vinzenz Rohrer	F	309	\N	\N	972500	2028	2	2004-09-09	\N	5'11	\N	R	173	\N	AUT	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11088	11088	\N	\N
5643	charlie-elick	Charlie Elick	D	301	\N	\N	931667	2029	3	2006-01-17	\N	6'3	\N	R	194	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10606	10606	\N	\N
5709	anton-lundmark	Anton Lundmark	F	299	8485495	\N	975000	2026	0	2001-04-19	Sarestad, SWE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8485495.png	R	192	RW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10914	10914	\N	\N
5727	curtis-douglas	Curtis Douglas	C	329	8480876	\N	1250000	2028	2	2000-03-06	Oakville, Ontario, CAN	6'9"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8480876.png	L	242	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8680	8680	\N	curtis-douglas
5580	artem-grushnikov	Artem Grushnikov	D	329	\N	\N	859167	2026	0	2003-03-20	\N	6'1	\N	L	203	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9727	9727	\N	artem-grushnikov
5725	cole-krygier	Cole Krygier	D	299	8481051	\N	837500	2025	0	2000-05-05	Orlando, Florida, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8481051.png	L	192	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9644	9644	\N	\N
5649	david-kampf	David Kampf	F	329	8480144	\N	1100000	2026	0	1995-01-12	Chomutov, CZE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8480144.png	L	198	C/LW/RW	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6860	6860	\N	david-kampf
5732	dennis-cesana	Dennis Cesana	D	299	8483400	\N	\N	\N	\N	1998-04-04	North Providence, Rhode Island, USA	5'9"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8483400.png	R	183	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9021	9021	\N	\N
5756	john-gormley	John Gormley	D	318	\N	\N	\N	\N	\N	2000-08-19	\N	6.04	\N	R	215	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10501	10501	\N	\N
5779	ryan-bottrill	Ryan Bottrill	F	308	\N	\N	\N	\N	\N	2004-02-04	\N	6.01	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11006	11006	\N	\N
5772	maxim-barbashev	Maxim Barbashev	F	323	\N	\N	\N	\N	\N	2003-12-18	\N	6.01	\N	L	187	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9752	9752	\N	\N
5777	romain-rodzinski	Romain Rodzinski	D	307	\N	\N	\N	\N	\N	2002-05-14	\N	6.01	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10935	10935	\N	\N
5719	caige-sterzer	Caige Sterzer	F	305	\N	\N	\N	\N	\N	2000-08-08	\N	6.05	\N	L	216	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11014	11014	\N	\N
5749	jack-bar	Jack Bar	D	318	\N	\N	\N	\N	\N	2010-07-02	\N	6.02	\N	R	210	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10698	10698	\N	\N
5672	lukas-gustafsson	Lukas Gustafsson	D	311	\N	\N	\N	\N	\N	2002-12-16	\N	5.10	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11042	11042	\N	\N
5684	peter-tischke	Peter Tischke	D	315	\N	\N	\N	\N	\N	1996-01-03	\N	6.01	\N	L	224	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7534	7534	\N	\N
5677	max-psenicka	Max Psenicka	D	323	\N	\N	\N	\N	\N	2007-01-18	\N	6'5	\N	R	177	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10669	10669	\N	\N
5715	braden-doyle	Braden Doyle	D	300	\N	\N	\N	\N	\N	2001-08-24	\N	5'11	\N	L	162	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10775	10775	\N	\N
5721	chase-pauls	Chase Pauls	D	298	\N	\N	\N	\N	\N	2003-10-07	\N	6.05	\N	R	220	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10375	10375	\N	\N
5331	landen-hookey	Landen Hookey	C	297	\N	\N	\N	\N	\N	2004-01-29	\N	6.05	\N	R	223	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10883	10883	\N	\N
5789	tarun-fizer	Tarun Fizer	R	319	8482957	\N	\N	\N	\N	2001-03-01	Calgary, Alberta, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/STL/8482957.png	R	168	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8898	8898	\N	\N
5703	aiden-dubinsky	Aiden Dubinsky	D	309	\N	\N	\N	\N	\N	2004-04-28	\N	6.00	\N	R	196	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11089	11089	\N	\N
5791	thomas-messineo	Thomas Messineo	D	318	\N	\N	\N	\N	\N	2002-05-02	\N	6.00	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11080	11080	\N	\N
5563	matthew-stienburg	Matthew Stienburg	F	303	\N	\N	\N	\N	\N	2000-10-07	\N	6'1	\N	R	182	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9683	9683	\N	\N
5663	jordan-gustafson	Jordan Gustafson	F	306	\N	\N	857500	2027	1	2004-01-20	\N	5'11	\N	L	194	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9271	9271	\N	\N
5669	konnor-smith	Konnor Smith	D	317	\N	\N	905000	2028	2	2004-11-06	\N	6'6	\N	L	234	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10116	10116	\N	\N
5680	milan-lucic	Milan Lucic	L	319	\N	\N	1000000	2024	0	1988-06-07	\N	6'3	\N	L	236	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=3068	3068	\N	\N
5681	miroslav-holinka	Miroslav Holinka	C	322	\N	\N	918333	2028	2	2005-11-10	\N	6'2	\N	R	188	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11070	11070	\N	\N
5589	dylan-james	Dylan James	L	304	\N	\N	1050000	2028	2	2003-10-12	\N	6'0	\N	L	181	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11071	11071	\N	\N
9951	matthew-highmore	Matthew Highmore	C	329	8478146	\N	775000	2026	0	1996-02-27	Halifax, Nova Scotia, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8478146.png	L	192	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6861	6861	\N	matthew-highmore
5753	james-stefan	James Stefan	R	296	\N	\N	895000	2027	1	2003-08-09	\N	6'0	\N	R	183	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10394	10394	\N	\N
5764	loke-johansson	Loke Johansson	D	314	\N	\N	860000	2029	3	2005-12-14	\N	6'3	\N	L	213	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10869	10869	\N	\N
10174	hunter-drew	Hunter Drew	R	326	8481003	\N	793333	2023	0	1998-10-21	Kingston, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8481003.png	R	191	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7627	7627	\N	\N
4972	igor-chernyshov	Igor Chernyshov	F	318	8484994	\N	966667	2028	2	2005-11-30	Penza, RUS	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8484994.png	R	195	LW	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10494	10494	\N	\N
5234	luca-marrelli	Luca Marrelli	D	301	8484777	\N	870333	2029	3	2005-10-04	Toronto, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8484777.png	R	181	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10950	10950	\N	\N
5002	victor-soderstrom	Victor Soderstrom	D	329	8481599	\N	775000	2026	0	2001-02-26	Gavle, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8481599.png	R	189	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7704	7704	\N	victor-soderstrom
5710	artem-guryev	Artem Guryev	D	329	\N	\N	860000	2026	0	2003-05-17	\N	6'4	\N	L	225	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9260	9260	\N	artem-guryev
4987	tye-felhaber	Tye Felhaber	F	329	8479746	\N	850000	2027	1	1998-08-05	Pembroke, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/COL/8479746.png	L	185	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7090	7090	\N	tye-felhaber
5163	jonathan-lekkerimaki	Jonathan Lekkerimaki	R	295	8483476	\N	950000	2027	1	2004-07-24	Tullinge, SWE	5'11"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8483476.png	R	172	RW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10057	10057	\N	\N
5265	carey-terrance	Carey Terrance	F	305	8484236	\N	920000	2028	2	2005-05-10	Akwesasne, New York, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8484236.png	L	203	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10276	10276	\N	\N
10091	ethan-bear	Ethan Bear	D	329	8478451	\N	850000	2027	1	1997-06-26	Regina, Saskatchewan, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8478451.png	R	219	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6807	6807	\N	ethan-bear
4956	kole-lind	Kole Lind	F	329	8479986	\N	775000	2026	0	1998-10-16	Swift Current, Saskatchewan, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8479986.png	R	190	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7101	7101	\N	kole-lind
5624	tommy-lafreniere	Tommy Lafreniere	R	296	\N	\N	\N	\N	\N	2007-01-16	\N	5'11	\N	R	172	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11065	11065	\N	\N
5112	brett-chorske	Brett Chorske	F	299	\N	\N	\N	\N	\N	2001-05-24	\N	6'7	\N	R	216	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10512	10512	\N	\N
5795	valtteri-piironen	Valtteri Piironen	D	302	\N	\N	\N	\N	\N	2001-09-11	\N	6.04	\N	L	201	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11029	11029	\N	\N
5798	will-riedell	Will Riedell	D	314	\N	\N	\N	\N	\N	1996-10-09	\N	6.02	\N	L	198	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9064	9064	\N	\N
5029	jamie-engelbert	Jamie Engelbert	F	316	\N	\N	\N	\N	\N	2000-06-21	\N	6.00	\N	L	165	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10503	10503	\N	\N
5763	landon-mccallum	Landon Mccallum	F	302	\N	\N	\N	\N	\N	2003-09-05	\N	5.11	\N	R	175	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10384	10384	\N	\N
418	dmitri-simashev	Dmitri Simashev	D	323	8484386	26	\N	\N	\N	2005-02-04	Kostroma, RUS	6'4"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8484386.png	L	198	D	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10665	10665	\N	\N
10576	zach-gallant	Zach Gallant	R	325	8480016	\N	\N	\N	\N	1999-03-06	London, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8480016.png	L	188	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7733	7733	\N	\N
11922	braidan-simmons-fischer	Braidan Simmons-fischer	D	308	\N	\N	\N	\N	\N	2002-01-26	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10886	10886	\N	\N
10835	chris-hedden	Chris Hedden	D	303	\N	\N	\N	\N	\N	2002-09-20	\N	6.00	\N	L	197	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10985	10985	\N	\N
10885	mack-oliphant	Mack Oliphant	D	318	\N	\N	\N	\N	\N	2002-12-28	\N	6.03	\N	R	195	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10988	10988	\N	\N
5786	stevie-leskovar	Stevie Leskovar	D	308	\N	\N	910000	2028	2	2004-09-09	\N	6'3	\N	L	207	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10611	10611	\N	\N
5439	cooper-flinton	Cooper Flinton	L	320	\N	\N	905000	2027	1	2003-08-16	\N	6'2	\N	L	213	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10526	10526	\N	\N
10289	sean-day	Sean Day	D	326	\N	\N	775000	2024	0	1998-01-09	\N	6'3	\N	L	225	\N	BEL	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7248	7248	\N	\N
10450	cole-eiserman	Cole Eiserman	F	326	\N	\N	1075000	2029	3	2006-08-29	\N	6'0	\N	L	195	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10994	10994	\N	\N
10501	harrison-brunicke	Harrison Brunicke	D	325	\N	\N	875000	2029	3	2006-05-08	\N	6'3	\N	R	201	\N	ZAF	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10542	10542	\N	\N
10789	nick-leddy	Nick Leddy	D	329	8475181	\N	4000000	2026	0	1991-03-20	Eden Prairie, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8475181.png	L	205	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=3859	3859	\N	nick-leddy
10513	ryan-mcallister	Ryan Mcallister	F	325	8484271	\N	896667	2026	0	2001-12-19	London, Ontario, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8484271.png	L	183	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9695	9695	\N	\N
10737	andrej-sustr	Andrej Sustr	D	326	8477205	\N	750000	2023	0	1990-11-29	Plzen, CZE	6'7"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8477205.png	R	217	D	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4874	4874	\N	\N
4939	christian-kyrou	Christian Kyrou	D	310	8483470	\N	850000	2027	1	2003-09-16	Toronto, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8483470.png	R	173	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9963	9963	\N	\N
4865	lane-pederson	Lane Pederson	C	329	8478967	\N	875000	2028	2	1997-08-04	Saskatoon, Saskatchewan, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8478967.png	R	196	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6872	6872	\N	lane-pederson
9911	liam-foudy	Liam Foudy	F	329	8480853	\N	850000	2027	1	2000-02-04	Scarborough, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8480853.png	L	186	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7655	7655	\N	liam-foudy
543	ian-moore	Ian Moore	D	317	8482178	3	1150000	2028	2	2002-01-04	Salt Lake City, Utah, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8482178.png	R	205	RW/D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10514	10514	\N	\N
4894	oliver-wahlstrom	Oliver Wahlstrom	R	318	8480789	\N	1000000	2025	0	2000-06-13	Portland, Maine, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8480789.png	R	205	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7575	7575	\N	\N
624	hunter-brzustewicz	Hunter Brzustewicz	D	298	8484150	48	950000	2027	1	2004-11-29	Washington, Michigan, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8484150.png	R	190	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10170	10170	\N	\N
9926	tristan-broz	Tristan Broz	F	325	8482698	\N	930833	2027	1	2002-10-10	River Falls, Wisconsin, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8482698.png	L	204	C/LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10164	10164	\N	\N
10636	emil-pieniniemi	Emil Pieniniemi	D	325	\N	\N	870000	2028	2	2005-03-02	\N	6'3	\N	L	191	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10172	10172	\N	\N
10696	jesse-pulkkinen	Jesse Pulkkinen	D	326	8484766	\N	897500	2027	1	2004-12-27	Jyvaskyla, FIN	6'7"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8484766.png	L	220	D	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10520	10520	\N	\N
95	adam-engstrom	Adam Engstrom	D	309	8483686	42	896667	2027	1	2003-11-17	Jarna, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8483686.png	L	193	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10437	10437	\N	\N
617	martin-pospisil	Martin Pospisil	C	329	8481028	76	2500000	2029	3	1999-11-19	Zvolen, SVK	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8481028.png	L	173	LW/RW	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7971	7971	\N	martin-pospisil
10841	daniil-prokhorov	Daniil Prokhorov	F	326	\N	\N	931667	2029	3	2007-04-27	\N	6'5	\N	L	209	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11092	11092	\N	\N
4808	dryden-hunt	Dryden Hunt	L	329	8478211	\N	837500	2027	1	1995-11-24	Cranbrook, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8478211.png	L	193	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6367	6367	\N	dryden-hunt
10829	broten-sabo	Broten Sabo	D	325	\N	\N	\N	\N	\N	2002-08-09	\N	6.02	\N	L	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11020	11020	\N	\N
10891	max-graham	Max Graham	F	325	\N	\N	\N	\N	\N	2004-05-21	\N	6'3	\N	L	215	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10853	10853	\N	\N
10896	quinn-beauchesne	Quinn Beauchesne	D	325	\N	\N	\N	\N	\N	2007-03-01	\N	6'0	\N	R	184	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11061	11061	\N	\N
10706	max-dorrington	Max Dorrington	F	326	\N	\N	\N	\N	\N	2001-08-30	\N	6.03	\N	R	215	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10510	10510	\N	\N
10917	tommy-budnick	Tommy Budnick	D	325	\N	\N	\N	\N	\N	2004-02-14	\N	6.01	\N	L	210	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10849	10849	\N	\N
4926	samuel-blais	Samuel Blais	L	309	\N	\N	\N	\N	\N	1996-06-17	\N	6.02	\N	L	206	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5970	5970	\N	\N
4841	benoit-olivier-groulx	Benoit-olivier Groulx	C	322	\N	\N	\N	\N	\N	2000-02-06	\N	6.02	https://www.hockeydb.com/ihdb/photos/benoit-groulx-2010-3.jpg	L	204	C/LW	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7693	7693	\N	\N
5047	tyler-angle	Tyler Angle	R	304	8481690	\N	\N	\N	\N	2000-09-30	Niagara Falls, Ontario, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/DET/8481690.png	L	166	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8581	8581	\N	\N
5195	grant-cruikshank	Grant Cruikshank	C	307	8484277	\N	\N	\N	\N	1998-07-19	Delafield, Wisconsin, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8484277.png	L	187	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9698	9698	\N	\N
5007	nate-smith	Nate Smith	C	299	\N	\N	\N	\N	\N	1998-10-19	\N	6.00	\N	R	177	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9220	9220	\N	\N
5787	sullivan-mack	Sullivan Mack	F	305	\N	\N	\N	\N	\N	2000-07-05	\N	6.01	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10581	10581	\N	\N
10221	cam-berg	Cam Berg	F	326	\N	\N	\N	\N	\N	2002-01-29	\N	6.00	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10564	10564	\N	\N
4896	ben-berard	Ben Berard	F	295	8484275	\N	\N	\N	\N	1999-02-13	Duncan, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8484275.png	L	192	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9674	9674	\N	\N
13146	teuvo-ter-v-inen	Teuvo Ter�v�inen	F	12	\N	\N	\N	\N	\N	1994-09-11	\N	5'11	\N	L	191	\N	FIN	https://frozenpool.dobbersports.com/players/teuvo-ter-v-inen	\N	\N	\N
353	dominic-james	Dominic James	C	320	8483752	17	910000	2027	1	2002-07-03	Plymouth, Michigan, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8483752.png	L	190	C/LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10903	10903	\N	\N
586	noah-ostlund	Noah Ostlund	C	315	8483500	86	950000	2027	1	2004-03-11	Stockholm, SWE	5'11"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8483500.png	L	180	C/LW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10157	10157	\N	\N
5428	nikita-susuyev	Nikita Susuyev	F	319	8484476	\N	905000	2028	2	2005-02-06	Ussuriysk, RUS	6'0"	https://assets.nhle.com/mugs/nhl/20262027/STL/8484476.png	L	172	RW	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10846	10846	\N	\N
733	arttu-hyry	Arttu Hyry	C	329	8484938	25	875000	2028	2	2001-04-06	Oulu, FIN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8484938.png	R	211	C/RW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10450	10450	\N	arttu-hyry
620	aydar-suniev	Aydar Suniev	L	298	8484234	36	923333	2027	1	2004-11-16	Kazan, RUS	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8484234.png	L	198	LW	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10755	10755	\N	\N
668	landon-slaggert	Landon Slaggert	F	316	8482172	84	900000	2027	1	2002-06-25	South Bend, Indiana, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8482172.png	L	180	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10342	10342	\N	\N
69	matt-kiersted	Matt Kiersted	D	329	8482641	26	812500	2027	1	1998-04-14	Elk River, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8482641.png	L	182	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8937	8937	\N	matt-kiersted
483	ilya-protas	Ilya Protas	C	307	8484999	62	889167	2029	3	2006-07-18	Vitebsk, BLR	6'6"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8484999.png	L	225	C/LW	BLR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10644	10644	\N	\N
4882	aleksanteri-kaskimaki	Aleksanteri Kaskimaki	F	319	8483463	\N	895000	2027	1	2004-02-06	Espoo, FIN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/STL/8483463.png	L	195	C	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10328	10328	\N	\N
597	radim-mrtka	Radim Mrtka	D	315	8485404	57	975000	2029	3	2007-06-09	Havlickuv Brod, CZE	6'6"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8485404.png	R	218	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10911	10911	\N	\N
567	jordan-harris	Jordan Harris	D	314	8480887	43	850000	2027	1	2000-07-07	Haverhill, Massachusetts, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8480887.png	L	189	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10955	10955	\N	\N
222	carter-yakemchuk	Carter Yakemchuk	D	297	8484759	58	975000	2029	3	2005-09-29	Fort McMurray, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8484759.png	R	219	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10922	10922	\N	\N
5151	maxim-groshev	Maxim Groshev	D	320	8482168	\N	875000	2028	2	2001-12-14	Agryz, RUS	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8482168.png	L	196	LW/RW	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9896	9896	\N	\N
385	emil-andrae	Emil Andrae	D	310	8482126	\N	1550000	2028	2	2002-02-23	Vastervik, SWE	5'9"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8482126.png	L	189	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9628	9628	\N	\N
273	ryan-graves	Ryan Graves	D	329	8477435	27	4500000	2029	3	1995-05-21	Yarmouth, Nova Scotia, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8477435.png	L	225	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6082	6082	\N	ryan-graves
4937	brendan-gaunce	Brendan Gaunce	C	329	8476867	\N	875000	2028	2	1994-03-25	Sudbury, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8476867.png	L	222	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5645	5645	\N	brendan-gaunce
5473	josiah-didier	Josiah Didier	D	309	8476421	\N	\N	\N	\N	1993-04-08	Littleton, Colorado, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8476421.png	R	218	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5889	5889	\N	\N
5082	justin-pearson	Justin Pearson	L	301	8484128	\N	\N	\N	\N	1998-05-17	Nashua, New Hampshire, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8484128.png	L	185	C/LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9633	9633	\N	\N
5497	brayden-hislop	Brayden Hislop	D	316	\N	\N	\N	\N	\N	2003-09-26	\N	6.01	\N	L	180	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10967	10967	\N	\N
10529	jack-st-ivany	Jack St. Ivany	D	329	\N	\N	800000	2027	1	1999-07-22	\N	6.04	\N	R	197	D	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9359	9359	\N	jack-st-ivany
4947	ryan-tverberg	Ryan Tverberg	F	322	8482525	\N	850000	2027	1	2002-01-30	Richmond Hill, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8482525.png	R	187	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9624	9624	\N	\N
4932	sam-morton	Sam Morton	C	329	8484821	\N	850000	2027	1	1999-07-28	Lafayette, Colorado, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8484821.png	L	185	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10037	10037	\N	sam-morton
5461	tomas-hamara	Tomas Hamara	D	297	8483683	\N	851667	2027	1	2004-03-09	Prague, CZE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8483683.png	L	194	D	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10145	10145	\N	\N
5690	ryan-hofer	Ryan Hofer	R	329	8482960	\N	851667	2026	0	2002-05-10	Headingley, Manitoba, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8482960.png	L	184	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9818	9818	\N	ryan-hofer
5263	andrei-loshko	Andrei Loshko	F	302	8484415	\N	920000	2028	2	2004-10-07	Zhlobin, BLR	6'1"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8484415.png	L	172	C	BLR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10181	10181	\N	\N
5172	angus-booth	Angus Booth	D	313	8483699	\N	852500	2027	1	2004-04-27	Montréal, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8483699.png	L	177	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9249	9249	\N	\N
13151	evander-kane	Evander Kane	LW	329	\N	\N	5125000	2026	0	1991-08-02	\N	6'2	\N	L	218	\N	CAN	https://frozenpool.dobbersports.com/players/evander-kane	\N	\N	evander-kane
5214	jake-livingstone	Jake Livingstone	D	329	8484256	\N	850000	2027	1	1999-04-16	Creston, British Columbia, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8484256.png	R	213	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9880	9880	\N	jake-livingstone
5394	dillon-boucher	Dillon Boucher	F	329	8485554	\N	850000	2027	1	1997-04-16	Head Chezzetcook, Nova Scotia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8485554.png	L	220	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10403	10403	\N	dillon-boucher
5301	caleb-macdonald	Caleb Macdonald	D	301	8485472	\N	922500	2027	1	2002-11-29	Cambridge, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8485472.png	L	225	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10895	10895	\N	\N
593	dennis-gilbert	Dennis Gilbert	D	329	8478502	8	850000	2027	1	1996-10-30	Buffalo, New York, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8478502.png	L	216	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7145	7145	\N	dennis-gilbert
536	tim-washe	Tim Washe	F	329	8485512	42	812500	2027	1	2001-08-25	Detroit, Michigan, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8485512.png	L	212	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10686	10686	\N	tim-washe
5644	chase-wheatcroft	Chase Wheatcroft	F	329	8484124	\N	862500	2026	0	2002-05-28	Calgary, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8484124.png	L	190	C/LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9750	9750	\N	chase-wheatcroft
5506	djibril-toure	Djibril Toure	D	297	8484534	\N	850000	2027	1	2003-06-05	Montréal, Quebec, CAN	6'7"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8484534.png	R	217	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9906	9906	\N	\N
5618	robby-fabbri	Robby Fabbri	C	329	8477952	\N	775000	2026	0	1996-01-22	Mississauga, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8477952.png	L	185	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5954	5954	\N	robby-fabbri
5409	anton-johansson	Anton Johansson	D	304	\N	\N	920000	2028	2	2004-06-10	\N	6'4	\N	R	172	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10509	10509	\N	\N
5532	brady-stonehouse	Brady Stonehouse	R	296	\N	\N	845000	2027	1	2004-08-06	\N	5'10	\N	L	193	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9229	9229	\N	\N
5558	landon-sim	Landon Sim	F	322	\N	\N	955000	2028	2	2004-07-17	\N	5'10	\N	L	166	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10836	10836	\N	\N
5745	herman-traff	Herman Traff	R	317	\N	\N	990000	2029	3	2005-12-31	\N	6'3	\N	R	216	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11017	11017	\N	\N
5790	terrell-goldsmith	Terrell Goldsmith	D	323	\N	\N	866667	2028	2	2005-05-13	\N	6'4	\N	L	223	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9773	9773	\N	\N
10858	gavin-mccarthy	Gavin Mccarthy	D	315	\N	\N	990833	2029	3	2005-06-02	\N	6'2	\N	R	194	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10987	10987	\N	\N
595	vsevolod-komarov	Vsevolod Komarov	D	315	8483732	76	865000	2027	1	2004-01-11	Chelyabinsk, RUS	6'4"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8483732.png	R	211	D	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10436	10436	\N	\N
5179	jack-rathbone	Jack Rathbone	D	329	8480056	\N	825000	2027	1	1999-05-20	Boston, Massachusetts, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8480056.png	L	188	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8619	8619	\N	jack-rathbone
5129	wyatt-aamodt	Wyatt Aamodt	D	329	8483569	\N	812500	2027	1	1997-11-22	Hermantown, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/COL/8483569.png	L	201	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9118	9118	\N	wyatt-aamodt
10685	egor-zamula	Egor Zamula	D	329	8481178	\N	1000000	2026	0	2000-03-30	Chelyabinsk, RUS	6'3"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8481178.png	L	200	D	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7850	7850	\N	egor-zamula
5707	anthony-kehrer	Anthony Kehrer	D	319	8485463	\N	\N	\N	\N	2002-03-04	Winnipeg, Manitoba, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/STL/8485463.png	R	210	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10516	10516	\N	\N
5746	hunter-johannes	Hunter Johannes	L	310	8484904	\N	\N	\N	\N	1998-07-24	Eden Prairie, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8484904.png	L	209	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10098	10098	\N	\N
13179	aatu-r-ty	Aatu R�ty	C	35	\N	\N	\N	\N	\N	2002-11-14	\N	6'2	\N	L	204	\N	FIN	https://frozenpool.dobbersports.com/players/aatu-r-ty	\N	\N	\N
449	marc-gatcomb	Marc Gatcomb	F	329	8483553	17	875000	2028	2	1999-07-22	Woburn, Massachusetts, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8483553.png	R	200	C/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9091	9091	\N	marc-gatcomb
521	judd-caulfield	Judd Caulfield	R	329	8481538	75	875000	2028	2	2001-03-19	Grand Forks, North Dakota, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8481538.png	R	220	C/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9702	9702	\N	judd-caulfield
5178	guillaume-richard	Guillaume Richard	D	301	8482692	\N	905000	2027	1	2003-02-10	Quebec City, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8482692.png	L	170	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10556	10556	\N	\N
174	jaroslav-chmelar	Jaroslav Chmelar	F	305	8482877	49	892500	2027	1	2003-07-20	Nove Mesto nad Metuji, CZE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8482877.png	R	226	LW/RW	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10062	10062	\N	\N
544	corey-schueneman	Corey Schueneman	D	329	8481461	\N	875000	2028	2	1995-09-02	Milford, Michigan, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8481461.png	L	204	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7545	7545	\N	corey-schueneman
339	logan-mailloux	Logan Mailloux	D	319	8482733	23	850000	2027	1	2003-04-15	Belle River, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/STL/8482733.png	R	212	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9860	9860	\N	\N
480	ivan-miroshnichenko	Ivan Miroshnichenko	L	307	8483491	63	925000	2028	2	2004-02-04	Ussuriysk, RUS	6'1"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8483491.png	R	185	LW	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9972	9972	\N	\N
191	vincent-iorio	Vincent Iorio	D	318	8482861	6	875833	2026	0	2002-11-14	Coquitlam, British Columbia, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8482861.png	R	220	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9165	9165	\N	\N
451	alexander-holtz	Alexander Holtz	F	306	8482125	10	837500	2027	1	2002-01-23	Stockholm, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8482125.png	R	198	RW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8711	8711	\N	\N
674	ethan-del-mastro	Ethan Del Mastro	D	316	8482807	38	878333	2026	0	2003-01-15	Burlington, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8482807.png	L	210	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9833	9833	\N	\N
455	raphael-lavoie	Raphael Lavoie	F	306	8481534	36	900000	2027	1	2000-09-25	Chambly, Quebec, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8481534.png	R	217	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8663	8663	\N	\N
635	sebastian-aho	Sebastian Aho	D	329	8478427	20	775000	2026	0	1997-07-26	Rauma, FIN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8478427.png	L	189	C/LW/RW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6845	6845	\N	sebastian-aho
247	david-jiricek	David Jiricek	D	310	8483460	5	1500000	2028	2	2003-11-28	Klatovy, CZE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8483460.png	R	204	D	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9545	9545	\N	\N
436	victor-mancini	Victor Mancini	D	295	8483768	90	1000000	2028	2	2002-05-26	Hancock, Michigan, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8483768.png	R	229	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10090	10090	\N	\N
5180	jacob-melanson	Jacob Melanson	F	302	8482874	\N	843333	2026	0	2003-04-22	Halifax, Nova Scotia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8482874.png	R	207	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9762	9762	\N	\N
579	konsta-helenius	Konsta Helenius	F	315	8484797	94	975000	2028	2	2006-05-11	Ylojarvi, FIN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8484797.png	R	190	C/RW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10444	10444	\N	\N
463	jeremy-davies	Jeremy Davies	D	329	8479602	84	1150000	2027	1	1996-12-04	Sainte-Anne-de-Bellevue, Quebec, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8479602.png	L	190	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7926	7926	\N	jeremy-davies
5284	david-gucciardi	David Gucciardi	D	307	8482683	\N	892500	2027	1	2002-10-09	Toronto, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8482683.png	L	185	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10573	10573	\N	\N
5127	tanner-molendyk	Tanner Molendyk	D	312	8484196	\N	950000	2028	2	2005-02-03	McBride, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8484196.png	L	190	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10890	10890	\N	\N
5430	riley-bezeau	Riley Bezeau	R	301	8483804	\N	940000	2027	1	2002-05-04	Mansfield, Massachusetts, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8483804.png	R	187	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9570	9570	\N	\N
5666	josh-lopina	Josh Lopina	C	316	8482925	\N	878333	2025	0	2001-02-16	Chicago, Illinois, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8482925.png	R	208	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9082	9082	\N	\N
5615	paul-ludwinski	Paul Ludwinski	F	316	8483480	\N	931667	2027	1	2004-04-23	Toronto, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8483480.png	L	172	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9668	9668	\N	\N
4965	danila-klimovich	Danila Klimovich	R	295	8482918	\N	850000	2027	1	2003-01-09	Pinsk, BLR	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8482918.png	R	202	RW	BLR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8928	8928	\N	\N
5335	maros-jedlicka	Maros Jedlicka	F	303	8484497	\N	\N	\N	\N	2002-10-23	Trnava, SVK	6'2"	https://assets.nhle.com/mugs/nhl/20262027/COL/8484497.png	L	194	C/LW/RW	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10161	10161	\N	\N
10290	aaron-huglen	Aaron Huglen	R	325	8481741	\N	\N	\N	\N	2001-03-06	Roseau, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8481741.png	R	178	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10851	10851	\N	\N
5653	drew-callin	Drew Callin	F	314	8483300	\N	\N	\N	\N	1995-04-05	Middelton, Wisconsin, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8483300.png	R	205	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8951	8951	\N	\N
10380	luke-rowe	Luke Rowe	D	326	8484756	\N	\N	\N	\N	1998-08-08	Succasunna, New Jersey, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8484756.png	R	209	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10020	10020	\N	\N
5621	simon-mack	Simon Mack	D	298	\N	\N	\N	\N	\N	2001-03-29	\N	5.10	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10627	10627	\N	\N
5568	ole-julian-bj-rgvik-holm	OLE JULIAN BJøRGVIK-HOLM	D	301	\N	\N	\N	\N	\N	2002-05-23	\N	6'4	\N	L	204	\N	NOR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8633	8633	\N	\N
5782	ryan-tattle	Ryan Tattle	F	314	\N	\N	\N	\N	\N	2001-09-07	\N	5.10	\N	L	180	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11032	11032	\N	\N
5800	zach-berzolla	Zach Berzolla	D	319	\N	\N	\N	\N	\N	1998-05-28	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8650	8650	\N	\N
5588	d-j-king	D.j. King	D	307	\N	\N	\N	\N	\N	2000-08-07	\N	6.03	\N	L	216	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8445	8445	\N	\N
5441	eamon-powell	Eamon Powell	D	299	8482096	\N	\N	\N	\N	2002-05-10	Marcellus, New York, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8482096.png	R	165	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10582	10582	\N	\N
4873	jordan-oesterle	Jordan Oesterle	D	329	8477851	\N	775000	2026	0	1992-06-25	Dearborn Heights, Michigan, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8477851.png	L	181	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5489	5489	\N	jordan-oesterle
4847	chris-wagner	Chris Wagner	C	319	8475780	\N	775000	2025	0	1991-05-27	Walpole, Massachusetts, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/STL/8475780.png	R	192	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4622	4622	\N	\N
5408	vladislav-kolyachonok	Vladislav Kolyachonok	D	321	8481609	\N	850000	2027	1	2001-05-26	Minsk, BLR	6'2"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8481609.png	L	198	D	BLR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8692	8692	\N	\N
5150	justin-kirkland	Justin Kirkland	C	329	8477993	\N	850000	2027	1	1996-08-02	Winnipeg, Manitoba, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8477993.png	L	183	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6426	6426	\N	justin-kirkland
5103	maxence-guenette	Maxence Guenette	D	310	8481679	\N	850000	2027	1	2001-04-28	L'Ancienne-Lorette, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8481679.png	R	210	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7788	7788	\N	\N
5410	austin-roest	Austin Roest	C	312	8483844	\N	870000	2027	1	2004-01-22	Coldstream, British Columbia, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8483844.png	R	184	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9228	9228	\N	\N
5307	julien-gauthier	Julien Gauthier	R	329	8479328	\N	775000	2026	0	1997-10-15	Pointe-aux-Trembles, Quebec, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/STL/8479328.png	R	230	LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6828	6828	\N	julien-gauthier
5369	blake-smith	Blake Smith	D	322	\N	\N	916667	2028	2	2004-10-05	\N	6'4	\N	L	211	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10635	10635	\N	\N
5528	aram-minnetian	Aram Minnetian	D	321	\N	\N	1075000	2029	3	2005-03-19	\N	5'11	\N	R	192	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11004	11004	\N	\N
5744	henry-brzustewicz	Henry Brzustewicz	D	313	\N	\N	1075000	2029	3	2007-02-09	\N	6'2	\N	R	203	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10711	10711	\N	\N
4886	quentin-musty	Quentin Musty	F	318	8484200	\N	950000	2028	2	2005-07-06	Hamburg, New York, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8484200.png	L	200	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10234	10234	\N	\N
4938	brian-pinho	Brian Pinho	F	299	8477314	\N	775000	2024	0	1995-05-11	Beverly, Massachusetts, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8477314.png	R	188	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7337	7337	\N	\N
10341	pierrick-dube	Pierrick Dube	R	326	8483920	\N	870000	2025	0	2001-01-07	Lyon, FRA	5'9"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8483920.png	R	172	RW	FRA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9515	9515	\N	\N
10062	cole-mcward	Cole Mcward	D	329	8484287	\N	875000	2028	2	2001-06-09	Fenton, Missouri, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8484287.png	R	196	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9886	9886	\N	cole-mcward
4975	louie-belpedio	Louie Belpedio	D	329	8478011	\N	812500	2027	1	1996-05-14	Skokie, Illinois, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8478011.png	R	197	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7024	7024	\N	louie-belpedio
5577	ryan-o-rourke	Ryan O'rourke	D	297	8482143	\N	886667	2025	0	2002-05-16	Pickering, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8482143.png	L	179	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8554	8554	\N	\N
5258	oscar-eklind	Oscar Eklind	F	329	8484928	\N	800000	2026	0	1998-07-14	Trelleborg, SWE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8484928.png	L	220	C/LW/RW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10432	10432	\N	oscar-eklind
229	alex-bump	Alex Bump	F	310	8483731	20	950000	2028	2	2003-11-20	Burnsville, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8483731.png	L	195	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10633	10633	\N	\N
5171	aleksi-heimosalmi	Aleksi Heimosalmi	D	300	8482860	\N	850000	2027	1	2003-05-08	Pori, FIN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8482860.png	R	181	D	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10463	10463	\N	\N
5413	cavan-fitzgerald	Cavan Fitzgerald	D	316	8478981	\N	\N	\N	\N	1996-08-23	Boston, Massachusetts, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8478981.png	L	190	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6799	6799	\N	\N
5549	jacob-truscott	Jacob Truscott	D	304	\N	\N	\N	\N	\N	2002-04-12	\N	6'1	\N	L	170	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10898	10898	\N	\N
5529	arnaud-durandeau	Arnaud Durandeau	L	295	8480242	\N	\N	\N	\N	1999-01-14	Montréal, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8480242.png	L	185	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7189	7189	\N	\N
5770	matthew-sop	Matthew Sop	L	308	8484511	\N	\N	\N	\N	2003-02-04	Kitchener, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8484511.png	L	185	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10306	10306	\N	\N
5788	tag-bertuzzi	Tag Bertuzzi	F	324	8483050	\N	\N	\N	\N	2001-02-18	Vancouver, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8483050.png	L	220	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9592	9592	\N	\N
5657	israel-mianscum	Israel Mianscum	L	309	\N	\N	\N	\N	\N	2003-04-18	\N	6.02	\N	L	202	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10368	10368	\N	\N
5088	roman-ahcan	Roman Ahcan	L	301	8483390	\N	\N	\N	\N	1999-03-24	Savage, Minnesota, USA	5'9"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8483390.png	L	170	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9025	9025	\N	\N
5027	brendan-furry	Brendan Furry	L	320	8484280	\N	\N	\N	\N	1998-07-08	Toledo, Ohio, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8484280.png	L	198	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9693	9693	\N	\N
4973	jani-nyman	Jani Nyman	F	302	8483497	\N	923333	2027	1	2004-07-30	Valkeakoski, FIN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8483497.png	L	212	RW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10127	10127	\N	\N
5332	ludvig-jansson	Ludvig Jansson	D	299	8483712	\N	905000	2028	2	2003-12-27	Stockholm, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8483712.png	R	176	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10913	10913	\N	\N
4994	henrik-rybinski	Henrik Rybinski	C	329	\N	\N	875000	2028	2	2001-06-26	\N	6'1	\N	R	172	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9356	9356	\N	henrik-rybinski
5635	alfons-freij	Alfons Freij	D	311	\N	\N	922500	2029	3	2006-02-12	\N	6'1	\N	L	187	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10993	10993	\N	\N
5084	lassi-thomson	Lassi Thomson	D	329	8481575	\N	775000	2026	0	2000-09-24	Tampere, FIN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8481575.png	R	195	D	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8590	8590	\N	lassi-thomson
5138	jan-mysak	Jan Mysak	C	329	8482136	\N	775000	2026	0	2002-06-24	Litvinov, CZE	5'11"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8482136.png	L	201	C	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8535	8535	\N	jan-mysak
5358	joel-nystrom	Joel Nystrom	D	300	8482911	\N	1225000	2030	4	2002-05-14	Karlstad, SWE	5'11"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8482911.png	R	178	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10597	10597	\N	\N
5176	danton-heinen	Danton Heinen	L	329	8478046	\N	2250000	2026	0	1995-07-05	Langley, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8478046.png	L	187	LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6354	6354	\N	danton-heinen
5038	ethan-gauthier	Ethan Gauthier	R	320	8484173	\N	896667	2028	2	2005-01-26	Scottsdale, Arizona, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8484173.png	R	184	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10607	10607	\N	\N
5108	tristan-allard	Tristan Allard	C	320	8484310	\N	897500	2027	1	2002-06-23	Ottawa, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8484310.png	L	217	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9754	9754	\N	\N
4981	david-gustafsson	David Gustafsson	C	329	8481019	\N	850000	2027	1	2000-04-11	Tingsryd, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8481019.png	L	196	C	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7777	7777	\N	david-gustafsson
678	sam-rinzel	Sam Rinzel	D	316	8483506	6	941667	2027	1	2004-06-25	Chanhassen, Minnesota, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8483506.png	R	194	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10939	10939	\N	\N
5229	cam-squires	Cam Squires	F	324	8484405	\N	870000	2028	2	2005-04-11	Charlottetown, Prince Edward Island, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8484405.png	R	165	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10621	10621	\N	\N
5019	justin-dowling	Justin Dowling	C	329	8475413	\N	812500	2027	1	1990-10-01	Calgary, Alberta, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8475413.png	L	178	C/LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4053	4053	\N	justin-dowling
5248	ethan-cardwell	Ethan Cardwell	F	318	8482206	\N	850000	2027	1	2002-08-30	Oshawa, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8482206.png	R	180	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9251	9251	\N	\N
5122	noah-chadwick	Noah Chadwick	D	322	8484464	\N	851667	2028	2	2005-05-10	Saskatoon, Saskatchewan, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8484464.png	L	207	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10119	10119	\N	\N
5136	henry-thrun	Henry Thrun	D	322	8481567	\N	850000	2027	1	2001-03-12	Southborough, Massachusetts, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8481567.png	L	211	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9994	9994	\N	\N
5175	carson-rehkopf	Carson Rehkopf	F	302	8484219	\N	923333	2028	2	2005-01-07	Barrie, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8484219.png	L	206	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10180	10180	\N	\N
5205	mikulas-hovorka	Mikulas Hovorka	D	299	8484933	\N	950000	2026	0	2001-07-01	Praha, CZE	6'6"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8484933.png	R	229	D	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10459	10459	\N	\N
5660	jake-chiasson	Jake Chiasson	R	329	8482706	\N	843333	2026	0	2003-05-25	Abbotsford, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8482706.png	R	181	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9938	9938	\N	jake-chiasson
5252	kyle-marino	Kyle Marino	R	312	8482981	\N	\N	\N	\N	1995-06-01	Niagara Falls, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8482981.png	R	220	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8825	8825	\N	\N
5638	braden-birnie	Braden Birnie	L	295	\N	\N	\N	\N	\N	2001-10-19	\N	6.02	\N	L	195	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11039	11039	\N	\N
5345	tobie-bisson	Tobie Bisson	D	309	8481110	\N	\N	\N	\N	1997-02-01	Rosemère, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8481110.png	L	207	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7274	7274	\N	\N
5051	cam-lund	Cam Lund	F	318	8483481	\N	\N	\N	\N	2004-06-07	Bridgewater, Massachusetts, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8483481.png	R	195	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10692	10692	\N	\N
5287	donavan-houle	Donavan Houle	F	318	8484923	\N	\N	\N	\N	1999-11-04	Montréal, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8484923.png	R	185	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10099	10099	\N	\N
676	kevin-korchinski	Kevin Korchinski	D	316	8483466	14	950000	2026	0	2004-06-21	Saskatoon, Saskatchewan, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8483466.png	L	185	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10382	10382	\N	\N
5578	travis-dermott	Travis Dermott	D	305	8478408	\N	775000	2025	0	1996-12-22	Newmarket, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8478408.png	L	200	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6381	6381	\N	\N
5072	alexis-gendron	Alexis Gendron	F	329	8483697	\N	860000	2026	0	2003-12-30	Coteau du Lac, Quebec, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8483697.png	L	175	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9825	9825	\N	alexis-gendron
5118	isaac-ratcliffe	Isaac Ratcliffe	L	312	8480019	\N	813750	2023	0	1999-02-15	London, Ontario, CAN	6'6"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8480019.png	L	200	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7121	7121	\N	\N
5065	matyas-melovsky	Matyas Melovsky	F	324	8484616	\N	972500	2028	2	2004-05-25	Zlin, CZE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8484616.png	R	190	C	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10815	10815	\N	\N
5393	daniel-walcott	Daniel Walcott	L	305	8478069	\N	750000	2023	0	1994-02-19	Ile Perrot, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8478069.png	L	175	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5944	5944	\N	\N
4906	atro-leppanen	Atro Leppanen	D	329	8485509	\N	850000	2027	1	1998-12-14	Mantta, FIN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8485509.png	L	183	D	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10879	10879	\N	atro-leppanen
5276	shai-buium	Shai Buium	D	304	8482777	\N	930833	2027	1	2003-03-26	San Diego, California, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DET/8482777.png	L	216	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10155	10155	\N	\N
5028	dans-locmelis	Dans Locmelis	C	314	8483704	\N	910000	2028	2	2004-01-21	Jelgava, LVA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8483704.png	L	179	C	LVA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10574	10574	\N	\N
5599	jesse-kiiskinen	Jesse Kiiskinen	R	304	\N	\N	923333	2028	2	2005-08-23	\N	6'2	\N	R	197	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11068	11068	\N	\N
5010	wyatt-bongiovanni	Wyatt Bongiovanni	C	329	8483579	\N	775000	2026	0	1999-07-24	Birmingham, Michigan, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8483579.png	L	197	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9142	9142	\N	wyatt-bongiovanni
4954	juraj-pekarcik	Juraj Pekarcik	F	319	8484393	\N	870000	2028	2	2005-09-12	Trstena, SVK	6'2"	https://assets.nhle.com/mugs/nhl/20262027/STL/8484393.png	L	204	LW	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10839	10839	\N	\N
5105	olivier-nadeau	Olivier Nadeau	R	329	8482746	\N	859167	2026	0	2003-01-15	Lac-Etchemin, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8482746.png	R	197	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9761	9761	\N	olivier-nadeau
5056	ivan-ivan	Ivan Ivan	F	303	8483930	\N	850000	2027	1	2002-08-20	Ostrava, CZE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/COL/8483930.png	L	190	C	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9969	9969	\N	\N
4977	noel-gunler	Noel Gunler	R	300	8482080	\N	813750	2026	0	2001-10-07	Lulea, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8482080.png	R	185	RW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9090	9090	\N	\N
37	taylor-ward	Taylor Ward	F	329	8483406	52	875000	2028	2	1998-03-31	Kelowna, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8483406.png	R	215	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9043	9043	\N	taylor-ward
5507	elliot-desnoyers	Elliot Desnoyers	L	308	8482452	\N	845833	2025	0	2002-01-21	Saint-Hyacinthe, Quebec, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8482452.png	L	183	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9381	9381	\N	\N
5313	pavol-regenda	Pavol Regenda	L	329	8483630	\N	775000	2026	0	1999-12-07	Michalovce, SVK	6'3"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8483630.png	L	215	LW/RW	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9190	9190	\N	pavol-regenda
5523	vitali-kravtsov	Vitali Kravtsov	R	329	\N	\N	775000	2026	0	1999-12-23	\N	6'3	\N	L	186	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7956	7956	\N	vitali-kravtsov
5286	devin-kaplan	Devin Kaplan	F	310	8483461	\N	930000	2027	1	2004-01-10	Bridgewater, New Jersey, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8483461.png	R	199	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10717	10717	\N	\N
5336	michael-buchinger	Michael Buchinger	D	319	8483427	\N	870000	2027	1	2004-04-25	Markham, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/STL/8483427.png	L	199	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9737	9737	\N	\N
4810	georgii-merkulov	Georgii Merkulov	L	329	8483567	\N	775000	2026	0	2000-10-10	Ryazan, RUS	5'11"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8483567.png	L	174	C/LW/RW	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9108	9108	\N	georgii-merkulov
5442	ethan-keppen	Ethan Keppen	R	296	8481660	\N	\N	\N	\N	2001-03-20	Fergus, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8481660.png	L	212	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8696	8696	\N	\N
5511	jacob-doty	Jacob Doty	F	313	8476576	\N	\N	\N	\N	1993-06-19	Denver, Colorado, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8476576.png	R	220	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5592	5592	\N	\N
362	charle-edouard-dastous	Charle-Edouard D'Astous	D	32	8480426	51	\N	\N	\N	1998-04-21	Rimouski, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8480426.png	L	211	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8057	8057	\N	\N
10469	c-j-smith	C.j. Smith	F	326	8480083	\N	\N	\N	\N	1994-12-01	Des Moines, Iowa, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8480083.png	L	191	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6858	6858	\N	\N
5095	danny-zhilkin	Danny Zhilkin	C	311	8483526	\N	\N	\N	\N	2003-12-19	Moscow, RUS	6'1"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8483526.png	L	192	C	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9746	9746	\N	\N
5557	kyler-kupka	Kyler Kupka	C	307	8485253	\N	\N	\N	\N	1999-05-11	Camrose, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8485253.png	L	190	C/LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10345	10345	\N	\N
5244	alex-kannok-leipert	Alex Kannok Leipert	D	304	8480998	\N	\N	\N	\N	2000-07-20	Nakhon Ratchasima, THA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/DET/8480998.png	R	190	D	THA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8927	8927	\N	\N
5708	anthony-romano	Anthony Romano	F	319	8481729	\N	\N	\N	\N	2000-10-07	Richmond Hill, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/STL/8481729.png	R	182	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10024	10024	\N	\N
5767	luke-mistelbacher	Luke Mistelbacher	R	297	\N	\N	\N	\N	\N	2005-11-02	\N	6.00	\N	R	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10598	10598	\N	\N
5603	kevin-conley	Kevin Conley	C	311	8483838	\N	\N	\N	\N	1997-02-17	Wausau, Wisconsin, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8483838.png	L	192	C/LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9343	9343	\N	\N
13139	thomas-novak	Thomas Novak	C	28	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	C	\N	https://frozenpool.dobbersports.com/players/thomas-novak	\N	\N	\N
5292	kirill-kirsanov	Kirill Kirsanov	D	313	8482922	\N	933750	2027	1	2002-09-19	Tver, RUS	6'1"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8482922.png	L	198	D	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10712	10712	\N	\N
5700	william-nicholl	William Nicholl	C	296	\N	\N	968333	2029	3	2006-05-24	\N	6'0	\N	L	184	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11064	11064	\N	\N
5537	charle-edouard-d-astous	Charle-edouard D'astous	D	329	\N	\N	875000	2027	1	1998-04-21	\N	6'2	\N	L	211	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8057	8057	\N	\N
10204	finn-harding	Finn Harding	D	325	\N	\N	905000	2028	2	2005-03-02	\N	6'1	\N	R	214	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10848	10848	\N	\N
5291	kaden-hammell	Kaden Hammell	D	302	8484433	\N	915833	2028	2	2005-03-12	Langley, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8484433.png	R	187	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10179	10179	\N	\N
5765	lucas-pettersson	Lucas Pettersson	C	317	\N	\N	919050	2029	3	2006-04-17	\N	5'11	\N	L	168	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11046	11046	\N	\N
46	scott-perunovich	Scott Perunovich	D	329	8481059	\N	850000	2027	1	1998-08-18	Hibbing, Minnesota, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8481059.png	L	175	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8519	8519	\N	scott-perunovich
5290	josh-brown	Josh Brown	D	329	8477384	\N	1000000	2027	1	1994-01-21	London, Ontario, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8477384.png	R	220	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6058	6058	\N	josh-brown
5398	jarred-tinordi	Jarred Tinordi	D	320	8475797	\N	800000	2025	0	1992-02-20	Millersville, Maryland, USA	6'6"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8475797.png	L	229	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4666	4666	\N	\N
5545	gustav-stjernberg	Gustav Stjernberg	D	303	8486118	\N	980000	2028	2	2002-10-12	Enebyberg, SWE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/COL/8486118.png	R	209	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10984	10984	\N	\N
5433	simon-robertsson	Simon Robertsson	F	319	8482716	\N	892500	2027	1	2003-02-05	Pitea, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/STL/8482716.png	L	197	RW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10330	10330	\N	\N
5389	blake-hillman	Blake Hillman	D	305	8479595	\N	925000	2019	0	1996-01-26	Elk River, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8479595.png	L	193	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7433	7433	\N	\N
5145	brett-harrison	Brett Harrison	R	329	8482739	\N	859167	2026	0	2003-06-07	London, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8482739.png	L	201	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9166	9166	\N	brett-harrison
8	max-jones	Max Jones	L	329	8479368	46	850000	2027	1	1998-02-17	Rochester, Michigan, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8479368.png	L	216	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6780	6780	\N	max-jones
446	trevor-connelly	Trevor Connelly	F	306	8484803	24	975000	2029	3	2006-02-28	Tustin, California, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8484803.png	L	175	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10579	10579	\N	\N
454	tanner-laczynski	Tanner Laczynski	F	329	8479550	28	900000	2029	3	1997-06-01	Minooka, Illinois, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8479550.png	R	211	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8448	8448	\N	tanner-laczynski
476	ethen-frank	Ethen Frank	R	329	8483573	53	2000000	2028	2	1998-02-05	Aurora, Colorado, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8483573.png	R	188	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9112	9112	\N	ethen-frank
4806	alex-belzile	Alex Belzile	F	329	8475968	\N	850000	2027	1	1991-08-31	St-Eloi, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8475968.png	R	198	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4819	4819	\N	alex-belzile
5564	max-wanner	Max Wanner	D	314	\N	\N	\N	\N	\N	2003-03-12	\N	6.03	\N	R	202	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9945	9945	\N	\N
5610	michael-koster	Michael Koster	D	308	\N	\N	\N	\N	\N	2001-04-13	\N	5.10	\N	R	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10940	10940	\N	\N
5612	nicky-leivermann	Nicky Leivermann	D	307	\N	\N	\N	\N	\N	1998-09-14	\N	5.11	\N	L	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9817	9817	\N	\N
5675	matthew-brown	Matthew Brown	F	296	\N	\N	\N	\N	\N	1999-08-09	\N	5.09	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9728	9728	\N	\N
5695	travis-howe	Travis Howe	R	317	8481367	\N	\N	\N	\N	1994-02-10	Hull, Massachusetts, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8481367.png	R	198	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7309	7309	\N	\N
5751	jacob-hudson	Jacob Hudson	F	314	\N	\N	\N	\N	\N	2000-12-02	\N	5.08	\N	R	179	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10348	10348	\N	\N
5797	will-mackinnon	Will Mackinnon	D	301	\N	\N	\N	\N	\N	2000-04-13	\N	5.11	\N	L	201	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9375	9375	\N	\N
10825	brayden-edwards	Brayden Edwards	F	325	\N	\N	\N	\N	\N	2004-12-23	\N	6.01	\N	R	188	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10854	10854	\N	\N
5687	rhett-parsons	Rhett Parsons	D	322	\N	\N	\N	\N	\N	2003-10-10	\N	6.03	\N	R	210	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10425	10425	\N	\N
10720	scooter-brickey	Scooter Brickey	D	325	8484833	\N	\N	\N	\N	1999-05-27	Mt. Clemens, Michigan, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8484833.png	R	214	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10042	10042	\N	\N
5382	noah-laaouan	Noah Laaouan	D	315	8483103	\N	\N	\N	\N	2001-03-07	Halifax, Nova Scotia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8483103.png	R	185	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9215	9215	\N	\N
10773	kaleb-pearson	Kaleb Pearson	F	321	8483065	\N	\N	\N	\N	2000-06-15	St. Mary's, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8483065.png	R	174	LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10905	10905	\N	\N
5728	danny-katic	Danny Katic	L	297	8485182	\N	\N	\N	\N	2000-08-04	Porcupine, Ontario, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8485182.png	L	220	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10461	10461	\N	\N
13180	carl-grundstr-m	Carl Grundstr�m	RW	27	\N	\N	\N	\N	\N	1997-12-01	\N	6'0	\N	L	200	\N	SWE	https://frozenpool.dobbersports.com/players/carl-grundstr-m	\N	\N	\N
344	anthony-cirelli	Anthony Cirelli	C	32	8478519	71	6250000	2031	5	1997-07-15	Etobicoke, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8478519.png	L	193	C/LW/RW	CAN	\N	\N	\N	\N
713	mathieu-olivier	Mathieu Olivier	R	14	8479671	24	3000000	2031	5	1997-02-11	Biloxi, Mississippi, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8479671.png	R	232	RW	USA	\N	\N	\N	\N
5520	riley-thompson	Riley Thompson	C	310	\N	\N	1025000	2027	1	2002-08-17	\N	6.04	\N	R	222	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11015	11015	\N	\N
209	stephen-halliday	Stephen Halliday	C	297	8483676	83	1075000	2028	2	2002-07-02	Ajax, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8483676.png	L	214	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10048	10048	\N	\N
136	jack-hughes	Jack Hughes	F	313	8481559	86	8000000	2030	4	2001-05-14	Orlando, Florida, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8481559.png	L	175	C/LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10715	10715	\N	\N
4832	brett-seney	Brett Seney	F	316	8478881	\N	775000	2025	0	1996-02-28	London, Ontario, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8478881.png	L	156	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7027	7027	\N	\N
271	declan-carlile	Declan Carlile	D	329	8483398	\N	1500000	2028	2	2000-05-18	Hartland, Michigan, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8483398.png	L	190	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9034	9034	\N	declan-carlile
286	michael-misa	Michael Misa	F	318	8485402	77	975000	2028	2	2007-02-16	Oakville, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8485402.png	L	185	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10693	10693	\N	\N
10426	eetu-liukas	Eetu Liukas	F	329	8482882	\N	867500	2026	0	2002-09-25	Turku, FIN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8482882.png	L	203	LW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9954	9954	\N	eetu-liukas
5063	marc-johnstone	Marc Johnstone	R	322	8483401	\N	775000	2025	0	1996-06-19	Cranford, New Jersey, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8483401.png	R	179	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9023	9023	\N	\N
535	anton-wahlberg	Anton Wahlberg	L	315	8484238	\N	896667	2028	2	2005-07-04	Malmo, SWE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8484238.png	L	205	C	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10052	10052	\N	\N
413	maveric-lamoureux	Maveric Lamoureux	D	323	8483472	10	950000	2027	1	2004-01-13	Laval, Quebec, CAN	6'6"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8483472.png	R	196	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10220	10220	\N	\N
5168	tuomas-uronen	Tuomas Uronen	F	306	8484466	\N	902500	2028	2	2005-03-19	Kerava, FIN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8484466.png	R	198	RW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10280	10280	\N	\N
741	kyle-capobianco	Kyle Capobianco	D	329	8478476	20	875000	2028	2	1997-08-13	Mississauga, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8478476.png	L	194	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6718	6718	\N	kyle-capobianco
181	gabe-perreault	Gabe Perreault	F	305	8484210	94	941667	2027	1	2005-05-07	Sherbrooke, Quebec, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8484210.png	L	180	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10737	10737	\N	\N
9920	aidan-mcdonough	Aidan Mcdonough	L	329	8481683	\N	850000	2027	1	1999-11-06	Milton, Massachusetts, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8481683.png	L	190	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9984	9984	\N	aidan-mcdonough
13137	vladimir-tarasenko	Vladimir Tarasenko	RW	329	8475765	\N	4750000	2026	0	1991-12-13	Yaroslavl, RUS	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8475765.png	L	219	RW	RUS	https://frozenpool.dobbersports.com/players/vladimir-tarasenko	\N	\N	vladimir-tarasenko
5604	kyle-jackson	Kyle Jackson	F	305	8483013	\N	\N	\N	\N	2002-10-17	Ottawa, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8483013.png	L	191	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9850	9850	\N	\N
5776	riley-mccourt	Riley Mccourt	D	297	8481086	\N	\N	\N	\N	2000-06-26	St. Catherines, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8481086.png	L	171	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8595	8595	\N	\N
5217	keean-washkurak	Keean Washkurak	C	297	8481667	\N	\N	\N	\N	2001-08-16	Waterloo, Ontario, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8481667.png	L	188	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8720	8720	\N	\N
5755	jett-jones	Jett Jones	F	319	8484641	\N	\N	\N	\N	2002-08-27	Westlock, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/STL/8484641.png	L	215	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9950	9950	\N	\N
5584	chris-harpur	Chris Harpur	D	320	8484309	\N	\N	\N	\N	1996-09-13	Niagara on the Lake, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8484309.png	L	201	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9744	9744	\N	\N
5741	garrett-pyke	Garrett Pyke	D	307	8484922	\N	\N	\N	\N	1999-08-01	Etobicoke, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8484922.png	L	186	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10114	10114	\N	\N
13186	isac-lundestr-m	Isac Lundestr�m	C	14	\N	\N	\N	\N	\N	1999-11-06	\N	6'1	\N	L	192	\N	SWE	https://frozenpool.dobbersports.com/players/isac-lundestr-m	\N	\N	\N
41	brandt-clarke	Brandt Clarke	D	19	8482730	92	7400000	2031	5	2003-02-09	Nepean, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8482730.png	R	200	D	CAN	\N	\N	\N	\N
13260	trent-miner	Trent Miner	G	329	8481529	\N	812500	2027	1	2001-02-05	Brandon, Manitoba, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/COL/8481529.png	L	185	\N	CAN	https://frozenpool.dobbersports.com/players/trent-miner	\N	\N	trent-miner
323	dalibor-dvorsky	Dalibor Dvorsky	F	319	8484164	54	950000	2028	2	2005-06-15	Zvolen, SVK	6'1"	https://assets.nhle.com/mugs/nhl/20262027/STL/8484164.png	L	207	C/RW	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10329	10329	\N	\N
5696	tyler-motte	Tyler Motte	L	299	8477353	\N	800000	2025	0	1995-03-10	St. Clair, Michigan, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8477353.png	L	194	C/LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6331	6331	\N	\N
5170	william-trudeau	William Trudeau	D	309	8482806	\N	850000	2027	1	2002-10-11	Varennes, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8482806.png	L	205	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9520	9520	\N	\N
287	zack-ostapchuk	Zack Ostapchuk	C	318	8482859	63	2350000	2030	4	2003-05-29	St. Albert, Alberta, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8482859.png	L	212	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9832	9832	\N	\N
9954	avery-hayes	Avery Hayes	R	325	8482993	\N	867500	2027	1	2002-10-10	Westland, Michigan, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8482993.png	R	180	C/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9816	9816	\N	\N
4821	jayson-megna	Jayson Megna	F	303	8477126	\N	775000	2024	0	1990-02-01	Fort Lauderdale, Florida, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/COL/8477126.png	R	190	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4584	4584	\N	\N
10069	joey-larson	Joey Larson	F	326	8485490	\N	823750	2026	0	2001-03-27	Brighton, Michigan, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8485490.png	R	194	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10562	10562	\N	\N
13259	thomas-milic	Thomas Milic	G	38	8483114	\N	866667	2027	1	2003-04-14	New Westminster, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8483114.png	L	175	\N	CAN	https://frozenpool.dobbersports.com/players/thomas-milic	\N	\N	\N
13289	gabriel-carriere	GABRIEL CARRIERE	G	329	8484887	\N	795000	2026	0	2000-11-05	Ottawa, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8484887.png	L	185	\N	CAN	https://frozenpool.dobbersports.com/players/gabriel-carriere	\N	\N	gabriel-carriere
13244	vyacheslav-buteyets	Vyacheslav Buteyets	G	7	8483746	\N	852500	2026	0	2002-05-29	Moscow, RUS	6'4"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8483746.png	L	220	\N	RUS	https://frozenpool.dobbersports.com/players/vyacheslav-buteyets	\N	\N	\N
5662	jayden-grubbe	Jayden Grubbe	C	329	8482704	\N	867500	2026	0	2003-01-12	Calgary, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8482704.png	R	201	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9936	9936	\N	jayden-grubbe
13276	sebastian-cossa	SEBASTIAN COSSA	G	304	8482657	\N	2000000	2028	2	2002-11-21	Hamilton, Ontario, CAN	6'6"	https://assets.nhle.com/mugs/nhl/20262027/DET/8482657.png	L	221	\N	CAN	https://frozenpool.dobbersports.com/players/sebastian-cossa	\N	\N	\N
13282	calle-clang	CALLE CLANG	G	317	8482477	\N	775000	2026	0	2002-05-20	Olofstrom, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8482477.png	L	192	\N	SWE	https://frozenpool.dobbersports.com/players/calle-clang	\N	\N	\N
13248	nico-daws	Nico Daws	G	329	8482076	\N	1100000	2028	2	2000-12-22	Munich, DEU	6'4"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8482076.png	L	205	\N	DEU	https://frozenpool.dobbersports.com/players/nico-daws	\N	\N	nico-daws
13291	simon-zajicek	SIMON ZAJICEK	G	314	8485538	\N	850000	2027	1	2001-06-25	Frydlant, CZE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8485538.png	L	185	\N	CZE	https://frozenpool.dobbersports.com/players/simon-zajicek	\N	\N	\N
13296	jakub-skarek	JAKUB SKAREK	G	329	8480819	\N	775000	2026	0	1999-11-10	Jihlava, CZE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8480819.png	L	211	\N	CZE	https://frozenpool.dobbersports.com/players/jakub-skarek	\N	\N	jakub-skarek
13304	connor-ungar	CONNOR UNGAR	G	329	8483083	\N	850000	2027	1	2002-01-12	Calgary, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8483083.png	L	190	\N	CAN	https://frozenpool.dobbersports.com/players/connor-ungar	\N	\N	connor-ungar
13325	olivier-rodrigue	OLIVIER RODRIGUE	G	316	8480885	\N	850000	2027	1	2000-07-06	Chicoutimi, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8480885.png	L	158	\N	CAN	https://frozenpool.dobbersports.com/players/olivier-rodrigue	\N	\N	\N
13278	ivan-fedotov	IVAN FEDOTOV	G	329	8478905	\N	3275000	2026	0	1996-11-28	Lappeenranta, FIN	6'7"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8478905.png	L	209	\N	FIN	https://frozenpool.dobbersports.com/players/ivan-fedotov	\N	\N	ivan-fedotov
13239	v-tek-van-ek	V�tek Van??ek	G	34	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/v-tek-van-ek	\N	\N	\N
13254	david-ji-ek	David Ji?�?ek	D	20	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/david-ji-ek	\N	\N	\N
13253	marcus-h-gberg	Marcus H�gberg	G	24	\N	\N	\N	\N	\N	1994-11-25	\N	6'5	\N	\N	232	\N	SWE	https://frozenpool.dobbersports.com/players/marcus-h-gberg	\N	\N	\N
13287	matthew-villalta	MATTHEW VILLALTA	G	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/matthew-villalta	\N	\N	\N
13263	petr-mr-zek	Petr Mr�zek	G	7	\N	\N	\N	\N	\N	1992-02-14	\N	6'2	\N	\N	192	\N	CZE	https://frozenpool.dobbersports.com/players/petr-mr-zek	\N	\N	\N
13267	samuel-poulin	Samuel Poulin	RW	28	\N	\N	\N	\N	\N	2001-02-25	\N	6'2	\N	L	217	\N	CAN	https://frozenpool.dobbersports.com/players/samuel-poulin	\N	\N	\N
13273	mads-s-gaard	Mads S?gaard	G	26	\N	\N	\N	\N	\N	2000-12-13	\N	6'7	\N	\N	231	\N	DNK	https://frozenpool.dobbersports.com/players/mads-s-gaard	\N	\N	\N
13300	mitch-gibson	MITCH GIBSON	G	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/mitch-gibson	\N	\N	\N
13327	owen-flores	OWEN FLORES	G	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/owen-flores	\N	\N	\N
13142	an-e-kopitar	Anze Kopitar	C	19	8471685	\N	\N	\N	\N	1987-08-24	\N	6'3	https://assets.nhle.com/mugs/nhl/20262027/LAK/8471685.png	L	225	C	SVN	https://frozenpool.dobbersports.com/players/an-e-kopitar	\N	\N	\N
5397	jackson-cates	Jackson Cates	F	316	8482654	\N	\N	\N	\N	1997-09-26	Stillwater, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8482654.png	L	201	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8768	8768	\N	\N
13349	mitchell-weeks	MITCHELL WEEKS	G	316	8483611	\N	\N	\N	\N	2001-06-22	Barrie, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8483611.png	L	187	\N	CAN	https://frozenpool.dobbersports.com/players/mitchell-weeks	\N	\N	\N
13345	hunter-jones	HUNTER JONES	G	309	8481545	\N	\N	\N	\N	2000-09-21	Brantford, Ontario, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8481545.png	L	204	\N	CAN	https://frozenpool.dobbersports.com/players/hunter-jones	\N	\N	\N
13355	cameron-rowe	CAMERON ROWE	G	315	8481571	\N	\N	\N	\N	2001-06-01	Wilmette, Illinois, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8481571.png	L	203	\N	USA	https://frozenpool.dobbersports.com/players/cameron-rowe	\N	\N	\N
13321	tomas-suchanek	TOMAS SUCHANEK	G	317	8483898	\N	895000	2027	1	2003-04-30	Prerov, CZE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8483898.png	L	185	\N	CZE	https://frozenpool.dobbersports.com/players/tomas-suchanek	\N	\N	\N
13193	spencer-stastney	Spencer Stastney	D	329	8481056	\N	1525000	2027	1	2000-01-04	Woodridge, Illinois, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8481056.png	L	184	D	USA	https://frozenpool.dobbersports.com/players/spencer-stastney	\N	\N	spencer-stastney
13329	topias-leinonen	TOPIAS LEINONEN	G	315	8483475	\N	920000	2028	2	2004-01-25	Jyvaskyla, FIN	6'6"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8483475.png	L	234	\N	FIN	https://frozenpool.dobbersports.com/players/topias-leinonen	\N	\N	\N
13246	braeden-cootes	Braeden Cootes	C	35	\N	\N	975000	2029	3	2007-02-09	\N	5'11	\N	R	183	\N	CAN	https://frozenpool.dobbersports.com/players/braeden-cootes	\N	\N	\N
13256	jake-livanavage	Jake Livanavage	D	28	\N	\N	975000	2027	1	2004-05-06	\N	5'11	\N	R	190	\N	USA	https://frozenpool.dobbersports.com/players/jake-livanavage	\N	\N	\N
13319	stanislav-berezhnoy	STANISLAV BEREZHNOY	G	316	\N	\N	975000	2027	1	2003-06-07	\N	6'4	\N	\N	218	\N	RUS	https://frozenpool.dobbersports.com/players/stanislav-berezhnoy	\N	\N	\N
13235	dmitriy-simashev	Dmitriy Simashev	D	34	\N	\N	950000	2028	2	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/dmitriy-simashev	\N	\N	\N
13197	luke-glendening	Luke Glendening	C	329	8476822	\N	775000	2026	0	1989-04-28	Grand Rapids, Michigan, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8476822.png	R	190	C/RW	USA	https://frozenpool.dobbersports.com/players/luke-glendening	\N	\N	luke-glendening
13306	kyle-keyser	KYLE KEYSER	G	329	\N	\N	850000	2027	1	1999-03-08	\N	6'2	\N	\N	186	\N	USA	https://frozenpool.dobbersports.com/players/kyle-keyser	\N	\N	kyle-keyser
13177	tanner-pearson	Tanner Pearson	LW	329	8476871	\N	1000000	2026	0	1992-08-10	Kitchener, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8476871.png	L	207	LW	CAN	https://frozenpool.dobbersports.com/players/tanner-pearson	\N	\N	tanner-pearson
13163	logan-stanley	Logan Stanley	D	329	8479378	\N	1250000	2026	0	1998-05-26	Waterloo, Ontario, CAN	6'7"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8479378.png	L	231	D	CAN	https://frozenpool.dobbersports.com/players/logan-stanley	\N	\N	logan-stanley
13194	mike-reilly	Mike Reilly	D	329	8476422	\N	1100000	2026	0	1993-07-13	Glenview, Illinois, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8476422.png	L	191	D	USA	https://frozenpool.dobbersports.com/players/mike-reilly	\N	\N	mike-reilly
13357	ben-kraws	BEN KRAWS	G	329	8484835	\N	775000	2026	0	2000-08-02	Cranbury, New Jersey, USA	6'5"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8484835.png	L	200	\N	USA	https://frozenpool.dobbersports.com/players/ben-kraws	\N	\N	ben-kraws
13340	dustin-tokarski	DUSTIN TOKARSKI	G	304	8474682	\N	775000	2025	0	1989-09-16	Watson, Saskatchewan, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/DET/8474682.png	L	198	\N	CAN	https://frozenpool.dobbersports.com/players/dustin-tokarski	\N	\N	\N
13185	matt-grzelcyk	Matt Grzelcyk	D	329	8476891	\N	1000000	2026	0	1994-01-05	Charlestown, Massachusetts, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8476891.png	L	180	D	USA	https://frozenpool.dobbersports.com/players/matt-grzelcyk	\N	\N	matt-grzelcyk
13351	talyn-boyko	TALYN BOYKO	G	329	8482869	\N	775000	2026	0	2002-10-16	Drumheller, Alberta, CAN	6'7"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8482869.png	L	220	\N	CAN	https://frozenpool.dobbersports.com/players/talyn-boyko	\N	\N	talyn-boyko
13331	isaac-poulter	ISAAC POULTER	G	329	8483659	\N	850000	2027	1	2001-09-12	Winnipeg, Manitoba, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8483659.png	L	174	\N	CAN	https://frozenpool.dobbersports.com/players/isaac-poulter	\N	\N	isaac-poulter
13335	yaniv-perets	YANIV PERETS	G	310	8484293	\N	805000	2025	0	2000-03-04	Dollard-des-Ormeaux, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8484293.png	L	181	\N	CAN	https://frozenpool.dobbersports.com/players/yaniv-perets	\N	\N	\N
13144	eeli-tolvanen	Eeli Tolvanen	RW	329	8480009	\N	3475000	2026	0	1999-04-22	Vihti, FIN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8480009.png	L	182	LW/RW	FIN	https://frozenpool.dobbersports.com/players/eeli-tolvanen	\N	\N	eeli-tolvanen
13152	james-van-riemsdyk	James van Riemsdyk	LW	329	8474037	\N	1000000	2026	0	1989-05-04	Middletown, New Jersey, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DET/8474037.png	L	210	LW/RW	USA	https://frozenpool.dobbersports.com/players/james-van-riemsdyk	\N	\N	james-van-riemsdyk
13209	tobias-bj-rnfot	Tobias Bj�rnfot	D	18	\N	\N	\N	\N	\N	2001-04-06	\N	6'0	\N	L	200	\N	SWE	https://frozenpool.dobbersports.com/players/tobias-bj-rnfot	\N	\N	\N
13212	jacob-markstr-m	Jacob Markstr�m	G	23	\N	\N	\N	\N	\N	1990-01-31	\N	6'6	\N	\N	207	\N	SWE	https://frozenpool.dobbersports.com/players/jacob-markstr-m	\N	\N	\N
13216	jonathan-lekkerim-ki	Jonathan Lekkerim�ki	RW	35	\N	\N	\N	\N	\N	2004-07-24	\N	5'11	\N	R	172	\N	SWE	https://frozenpool.dobbersports.com/players/jonathan-lekkerim-ki	\N	\N	\N
13218	juuso-p-rssinen	Juuso P�rssinen	C	25	\N	\N	\N	\N	\N	2001-02-01	\N	6'3	\N	L	207	\N	FIN	https://frozenpool.dobbersports.com/players/juuso-p-rssinen	\N	\N	\N
13129	tim-st-tzle	Tim St�tzle	LW	26	\N	\N	\N	\N	\N	2002-01-15	\N	6'0	\N	L	187	\N	DEU	https://frozenpool.dobbersports.com/players/tim-st-tzle	\N	\N	\N
13134	alexis-lafreni-re	Alexis Lafreni�re	LW	25	\N	\N	\N	\N	\N	2001-10-11	\N	6'2	\N	L	191	\N	CAN	https://frozenpool.dobbersports.com/players/alexis-lafreni-re	\N	\N	\N
13140	simon-holmstr-m	Simon Holmstr�m	RW	24	\N	\N	\N	\N	\N	2001-05-24	\N	6'1	\N	L	208	\N	SWE	https://frozenpool.dobbersports.com/players/simon-holmstr-m	\N	\N	\N
13236	victor-s-derstr-m	Victor S�derstr�m	D	3	\N	\N	\N	\N	\N	2001-02-26	\N	6'0	\N	R	189	\N	SWE	https://frozenpool.dobbersports.com/players/victor-s-derstr-m	\N	\N	\N
5392	cooper-moore	Cooper Moore	D	305	8481745	\N	\N	\N	\N	2001-02-16	Greenwich, Connecticut, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8481745.png	L	185	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10735	10735	\N	\N
13243	mat-j-bl-mel	Mat?j Bl�mel	RW	3	\N	\N	\N	\N	\N	2000-05-31	\N	6'0	\N	L	202	\N	CZE	https://frozenpool.dobbersports.com/players/mat-j-bl-mel	\N	\N	\N
13252	rafa-l-harvey-pinard	Rafa�l Harvey-Pinard	LW	28	\N	\N	\N	\N	\N	1999-01-06	\N	5'9	\N	L	179	\N	CAN	https://frozenpool.dobbersports.com/players/rafa-l-harvey-pinard	\N	\N	\N
13128	david-pastr-k	David Pastr?�k	RW	3	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/david-pastr-k	\N	\N	\N
13132	tom-hertl	Tom�? Hertl	C	36	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/tom-hertl	\N	\N	\N
13231	luk-dost-l	Luk�? Dost�l	G	7	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/luk-dost-l	\N	\N	\N
13242	nils-man	Nils �man	C	35	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/nils-man	\N	\N	\N
13272	arvid-s-derblom	Arvid S�derblom	G	12	\N	\N	\N	\N	\N	1999-08-19	\N	6'3	\N	\N	180	\N	SWE	https://frozenpool.dobbersports.com/players/arvid-s-derblom	\N	\N	\N
13227	oscar-fisker-molgaard	Oscar Fisker Molgaard	C	30	8484168	\N	923333	2028	2	2005-02-18	Hjørring, DNK	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8484168.png	L	168	C	DNK	https://frozenpool.dobbersports.com/players/oscar-fisker-molgaard	\N	\N	\N
5399	kalan-lind	Kalan Lind	L	312	8484187	\N	870000	2028	2	2005-01-25	Swift Current, Saskatchewan, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8484187.png	L	162	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10554	10554	\N	\N
13247	pheonix-copley	Pheonix Copley	G	329	8477831	\N	850000	2027	1	1992-01-18	North Pole, Alaska, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8477831.png	L	205	\N	USA	https://frozenpool.dobbersports.com/players/pheonix-copley	\N	\N	pheonix-copley
13251	brandon-halverson	Brandon Halverson	G	329	\N	\N	850000	2027	1	1996-03-29	\N	6'5	\N	\N	235	\N	USA	https://frozenpool.dobbersports.com/players/brandon-halverson	\N	\N	brandon-halverson
13222	travis-hamonic	Travis Hamonic	D	329	8474612	\N	1000000	2026	0	1990-08-16	St. Malo, Manitoba, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/DET/8474612.png	R	193	D	CAN	https://frozenpool.dobbersports.com/players/travis-hamonic	\N	\N	travis-hamonic
13221	jake-bean	Jake Bean	D	329	8479402	\N	1750000	2026	0	1998-06-09	Calgary, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8479402.png	L	191	D	CAN	https://frozenpool.dobbersports.com/players/jake-bean	\N	\N	jake-bean
13203	pierre-olivier-joseph	Pierre-Olivier Joseph	D	329	8480058	\N	775000	2026	0	1999-07-01	Laval, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8480058.png	L	185	D	CAN	https://frozenpool.dobbersports.com/players/pierre-olivier-joseph	\N	\N	pierre-olivier-joseph
13215	mathew-dumba	Mathew Dumba	D	329	\N	\N	3750000	2026	0	1994-07-25	\N	6'0	\N	R	191	\N	CAN	https://frozenpool.dobbersports.com/players/mathew-dumba	\N	\N	mathew-dumba
13234	jonathan-quick	Jonathan Quick	G	329	8471734	\N	1550000	2026	0	1986-01-21	Milford, Connecticut, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8471734.png	L	219	\N	USA	https://frozenpool.dobbersports.com/players/jonathan-quick	\N	\N	jonathan-quick
13324	vyacheslav-peksa	VYACHESLAV PEKSA	G	329	8482940	\N	851667	2026	0	2002-08-27	Magnitogorsk, RUS	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8482940.png	L	181	\N	RUS	https://frozenpool.dobbersports.com/players/vyacheslav-peksa	\N	\N	vyacheslav-peksa
13210	adam-boqvist	Adam Boqvist	D	329	8480871	\N	850000	2026	0	2000-08-15	Falun, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8480871.png	R	195	D	SWE	https://frozenpool.dobbersports.com/players/adam-boqvist	\N	\N	adam-boqvist
13261	sam-montembeault	Sam Montembeault	G	329	\N	\N	3150000	2027	1	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/sam-montembeault	\N	\N	sam-montembeault
13275	remi-poirier	REMI POIRIER	G	329	8482465	\N	812500	2027	1	2001-10-06	Farnham, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8482465.png	L	211	\N	CAN	https://frozenpool.dobbersports.com/players/remi-poirier	\N	\N	remi-poirier
13240	danil-zhilkin	Danil Zhilkin	C	38	\N	\N	860000	2027	1	2003-12-19	\N	6'1	\N	L	192	\N	RUS	https://frozenpool.dobbersports.com/players/danil-zhilkin	\N	\N	\N
13249	michael-dipietro	Michael DiPietro	G	329	8480022	\N	812500	2027	1	1999-06-09	Windsor, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8480022.png	L	205	\N	CAN	https://frozenpool.dobbersports.com/players/michael-dipietro	\N	\N	michael-dipietro
13255	niklas-kokko	Niklas Kokko	G	30	\N	\N	923333	2027	1	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/niklas-kokko	\N	\N	\N
13205	curtis-lazar	Curtis Lazar	C	329	8477508	\N	775000	2026	0	1995-02-02	Salmon Arm, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8477508.png	R	203	C/RW	CAN	https://frozenpool.dobbersports.com/players/curtis-lazar	\N	\N	curtis-lazar
13201	sammy-blais	Sammy Blais	LW	329	8478104	\N	925000	2028	2	1996-06-17	Montmagny, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8478104.png	L	206	LW/RW	CAN	https://frozenpool.dobbersports.com/players/sammy-blais	\N	\N	sammy-blais
458	jonas-rondbjerg	Jonas Rondbjerg	R	329	8480007	46	850000	2027	1	1999-03-31	Horsholm, DNK	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8480007.png	L	206	RW	DNK	\N	\N	\N	jonas-rondbjerg
13339	ruslan-khazheyev	RUSLAN KHAZHEYEV	G	300	8484440	\N	\N	\N	\N	2004-11-20	Chelyabinsk, RUS	6'6"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8484440.png	L	211	\N	RUS	https://frozenpool.dobbersports.com/players/ruslan-khazheyev	\N	\N	\N
13301	georgii-romanov	GEORGII ROMANOV	G	319	\N	\N	\N	\N	\N	1999-12-15	\N	6'5	\N	\N	207	\N	RUS	https://frozenpool.dobbersports.com/players/georgii-romanov	\N	\N	\N
13274	daniel-vlada	Daniel Vlada?	G	27	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/daniel-vlada	\N	\N	\N
13344	t-j-semptimphelter	T.J. SEMPTIMPHELTER	G	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/t-j-semptimphelter	\N	\N	\N
13354	kaidan-mbereko	KAIDAN MBEREKO	G	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/kaidan-mbereko	\N	\N	\N
13160	gabriel-perreault	Gabriel Perreault	RW	25	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/gabriel-perreault	\N	\N	\N
13211	joshua-dunne	Joshua Dunne	C	9	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/joshua-dunne	\N	\N	\N
13220	nicolas-aub-kubel	Nicolas Aub�-Kubel	RW	20	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/nicolas-aub-kubel	\N	\N	\N
13202	danil-but	Danil But	LW	34	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/danil-but	\N	\N	\N
13266	ji-patera	Ji?� Patera	G	35	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/players/ji-patera	\N	\N	\N
5652	derek-daschke	Derek Daschke	D	295	8484577	\N	\N	\N	\N	1998-01-06	Troy, Michigan, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8484577.png	L	194	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10289	10289	\N	\N
5579	tyson-empey	Tyson Empey	L	311	8483218	\N	\N	\N	\N	1995-06-29	Swift Current, Saskatchewan, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8483218.png	L	190	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8809	8809	\N	\N
5555	justin-nachbaur	Justin Nachbaur	R	307	8483016	\N	\N	\N	\N	2000-03-04	Winnipeg, Manitoba, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8483016.png	L	212	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9012	9012	\N	\N
5538	chase-dafoe	Chase Dafoe	F	316	8486055	\N	\N	\N	\N	2002-02-25	Beverly, Massachusetts, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8486055.png	L	201	C/LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10975	10975	\N	\N
13290	zach-sawchenko	ZACH SAWCHENKO	G	329	8479313	\N	850000	2027	1	1997-12-30	Calgary, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8479313.png	L	187	\N	CAN	https://frozenpool.dobbersports.com/players/zach-sawchenko	\N	\N	zach-sawchenko
13316	will-cranley	WILL CRANLEY	G	329	8482205	\N	850000	2027	1	2002-02-26	Peterborough, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/STL/8482205.png	L	194	\N	CAN	https://frozenpool.dobbersports.com/players/will-cranley	\N	\N	will-cranley
13281	matt-tomkins	MATT TOMKINS	G	329	8477035	\N	812500	2027	1	1994-06-19	Edmonton, Alberta, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8477035.png	L	191	\N	CAN	https://frozenpool.dobbersports.com/players/matt-tomkins	\N	\N	matt-tomkins
13297	jiri-patera	JIRI PATERA	G	329	8480238	\N	850000	2027	1	1999-02-24	Praha, CZE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8480238.png	L	212	\N	CZE	https://frozenpool.dobbersports.com/players/jiri-patera	\N	\N	jiri-patera
13286	vadim-zherenko	VADIM ZHERENKO	G	329	8481689	\N	775000	2026	0	2001-03-15	Moscow, RUS	6'4"	https://assets.nhle.com/mugs/nhl/20262027/STL/8481689.png	L	210	\N	RUS	https://frozenpool.dobbersports.com/players/vadim-zherenko	\N	\N	vadim-zherenko
13295	domenic-divincentiis	DOMENIC DIVINCENTIIS	G	311	\N	\N	858333	2027	1	2004-03-04	\N	6'2	\N	\N	191	\N	CAN	https://frozenpool.dobbersports.com/players/domenic-divincentiis	\N	\N	\N
13305	kirill-gerasimyuk	KIRILL GERASIMYUK	G	299	8482914	\N	900000	2027	1	2003-08-22	RUS	6'2"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8482914.png	L	178	\N	RUS	https://frozenpool.dobbersports.com/players/kirill-gerasimyuk	\N	\N	\N
13326	jon-gillies	JON GILLIES	G	320	8476903	\N	750000	2023	0	1994-01-22	Concord, New Hampshire, USA	6'6"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8476903.png	L	223	\N	USA	https://frozenpool.dobbersports.com/players/jon-gillies	\N	\N	\N
13315	isaiah-saville	ISAIAH SAVILLE	G	313	8481520	\N	849667	2025	0	2000-09-21	Anchorage, Alaska, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8481520.png	R	200	\N	USA	https://frozenpool.dobbersports.com/players/isaiah-saville	\N	\N	\N
13294	jakub-malek	JAKUB MALEK	G	329	8482867	\N	875000	2028	2	2002-04-11	Kromeriz, CZE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8482867.png	L	170	\N	CZE	https://frozenpool.dobbersports.com/players/jakub-malek	\N	\N	jakub-malek
13332	aku-koskenvuo	AKU KOSKENVUO	G	295	8482875	\N	887500	2027	1	2003-02-26	Espoo, FIN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8482875.png	L	173	\N	FIN	https://frozenpool.dobbersports.com/players/aku-koskenvuo	\N	\N	\N
13311	callum-tung	CALLUM TUNG	G	305	8485489	\N	922500	2028	2	2003-11-23	Port Moody, British Columbia, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8485489.png	L	209	\N	CAN	https://frozenpool.dobbersports.com/players/callum-tung	\N	\N	\N
13352	adam-gajan	ADAM GAJAN	G	316	8484171	\N	1050000	2028	2	2004-05-06	Poprad, SVK	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8484171.png	L	167	\N	SVK	https://frozenpool.dobbersports.com/players/adam-gajan	\N	\N	\N
13284	erik-portillo	ERIK PORTILLO	G	329	8481707	\N	800000	2027	1	2000-09-03	Gothenburg, SWE	6'6"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8481707.png	L	218	\N	SWE	https://frozenpool.dobbersports.com/players/erik-portillo	\N	\N	erik-portillo
13303	ivan-prosvetov	IVAN PROSVETOV	G	329	8481031	\N	950000	2026	0	1999-03-05	Moscow, RUS	6'5"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8481031.png	L	195	\N	RUS	https://frozenpool.dobbersports.com/players/ivan-prosvetov	\N	\N	ivan-prosvetov
13338	nikita-quapp	NIKITA QUAPP	G	329	8482895	\N	775000	2026	0	2003-01-25	Ravensburg, DEU	6'3"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8482895.png	L	207	\N	DEU	https://frozenpool.dobbersports.com/players/nikita-quapp	\N	\N	nikita-quapp
13348	trey-augustine	TREY AUGUSTINE	G	304	\N	\N	1075000	2029	3	2005-02-23	\N	6'1	\N	\N	183	\N	USA	https://frozenpool.dobbersports.com/players/trey-augustine	\N	\N	\N
13356	harrison-meneghin	HARRISON MENEGHIN	G	320	\N	\N	922500	2028	2	2004-09-13	\N	6'3	\N	\N	177	\N	CAN	https://frozenpool.dobbersports.com/players/harrison-meneghin	\N	\N	\N
5586	connor-punnett	Connor Punnett	D	321	8484523	\N	895000	2027	1	2003-06-16	North Bay, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8484523.png	L	203	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10449	10449	\N	\N
5488	vincent-arseneau	Vincent Arseneau	L	309	8477255	\N	\N	\N	\N	1992-03-26	Quebec City, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8477255.png	L	215	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4830	4830	\N	\N
5571	reilly-webb	Reilly Webb	D	307	8480241	\N	\N	\N	\N	1999-05-04	Stoney Creek, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8480241.png	R	195	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10956	10956	\N	\N
13328	william-rousseau	WILLIAM ROUSSEAU	G	308	8482752	\N	\N	\N	\N	2003-01-09	Trois-Rivières, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8482752.png	L	193	\N	CAN	https://frozenpool.dobbersports.com/players/william-rousseau	\N	\N	\N
5400	kyle-looft	Kyle Looft	D	321	8484940	\N	\N	\N	\N	1998-06-27	Mankato, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8484940.png	L	192	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10147	10147	\N	\N
5123	rhett-pitlick	Rhett Pitlick	R	296	8481746	\N	\N	\N	\N	2001-02-07	Coral Springs, Florida, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8481746.png	L	170	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10599	10599	\N	\N
5381	matteo-costantini	Matteo Costantini	C	315	8482219	\N	\N	\N	\N	2002-08-16	St. Catharines, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8482219.png	L	194	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10930	10930	\N	\N
5566	nathan-bastian	Nathan Bastian	R	329	8479414	\N	775000	2026	0	1997-12-06	Kitchener, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8479414.png	R	217	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6851	6851	\N	nathan-bastian
4895	amadeus-lombardi	Amadeus Lombardi	C	329	8483695	\N	875000	2028	2	2003-06-05	Newmarket, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/DET/8483695.png	L	180	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9718	9718	\N	amadeus-lombardi
13226	colin-miller	Colin Miller	D	329	8476525	\N	1500000	2026	0	1992-10-29	Sault Ste. Marie, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8476525.png	R	200	D	CAN	https://frozenpool.dobbersports.com/players/colin-miller	\N	\N	colin-miller
5460	steven-santini	Steven Santini	D	329	8477463	\N	812500	2027	1	1995-03-07	Bronxville, New York, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8477463.png	R	217	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6522	6522	\N	steven-santini
5509	jackson-edward	Jackson Edward	D	310	8483438	\N	860000	2027	1	2004-02-27	Newmarket, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8483438.png	L	200	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10349	10349	\N	\N
13198	adam-erne	Adam Erne	LW	329	8477454	\N	775000	2026	0	1995-04-20	New Haven, Connecticut, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8477454.png	L	209	LW/RW	USA	https://frozenpool.dobbersports.com/players/adam-erne	\N	\N	adam-erne
5190	william-wallinder	William Wallinder	D	329	8482171	\N	875000	2028	2	2002-07-28	Solleftea, SWE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/DET/8482171.png	L	208	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9672	9672	\N	william-wallinder
429	liam-ohgren	Liam Ohgren	L	308	8483499	92	950000	2027	1	2004-01-28	Stockholm, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8483499.png	L	187	LW	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10084	10084	\N	\N
5748	ilya-solovyov	Ilya Solovyov	D	303	8482470	\N	850000	2027	1	2000-07-20	Mogilev, BLR	6'3"	https://assets.nhle.com/mugs/nhl/20262027/COL/8482470.png	L	208	D	BLR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8784	8784	\N	\N
5096	dylan-peterson	Dylan Peterson	F	329	8482121	\N	850000	2027	1	2002-01-08	Roseville, California, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/STL/8482121.png	R	209	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10143	10143	\N	dylan-peterson
5391	charles-alexis-legault	Charles Alexis Legault	D	300	8484428	\N	915833	2027	1	2003-09-05	Montréal, Quebec, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8484428.png	R	220	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10460	10460	\N	\N
4983	harrison-scott	Harrison Scott	F	329	8485485	\N	875000	2028	2	2000-09-27	San Jose, California, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8485485.png	L	204	C/LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10555	10555	\N	harrison-scott
4891	luca-cagnoni	Luca Cagnoni	D	318	8484152	\N	903333	2027	1	2004-12-21	Burnaby, British Columbia, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8484152.png	L	180	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10226	10226	\N	\N
5260	tyler-pitlick	Tyler Pitlick	F	329	8475752	\N	812500	2027	1	1991-11-01	Minneapolis, Minnesota, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8475752.png	R	199	LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4216	4216	\N	tyler-pitlick
575	sam-carrick	Sam Carrick	C	329	8475842	10	1000000	2027	1	1992-02-04	Stouffville, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8475842.png	R	202	C/RW	CAN	\N	\N	\N	sam-carrick
5593	guillaume-brisebois	Guillaume Brisebois	D	329	8478465	\N	900000	2027	1	1997-07-21	Longueuil, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8478465.png	L	175	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6901	6901	\N	guillaume-brisebois
5100	karsen-dorwart	Karsen Dorwart	F	329	8485483	\N	975000	2026	0	2002-09-17	Sherwood, Oregon, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8485483.png	L	194	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10718	10718	\N	karsen-dorwart
5036	clark-bishop	Clark Bishop	C	329	8478056	\N	775000	2026	0	1996-03-29	St. John's, Newfoundland and Labrador, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8478056.png	L	197	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6453	6453	\N	clark-bishop
4990	carson-meyer	Carson Meyer	R	329	8480292	\N	812500	2027	1	1997-08-18	Powell, Ohio, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8480292.png	R	187	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8580	8580	\N	carson-meyer
5098	jean-luc-foudy	Jean-luc Foudy	R	308	8482147	\N	878333	2025	0	2002-05-13	Scarborough, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8482147.png	R	177	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8576	8576	\N	\N
5000	oasiz-wiesblatt	Oasiz Wiesblatt	C	312	8484537	\N	\N	\N	\N	2004-04-08	Vancouver, British Columbia, CAN	5'7"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8484537.png	L	180	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10832	10832	\N	\N
5383	ryan-sandelin	Ryan Sandelin	F	308	8484253	\N	\N	\N	\N	1999-01-03	Hermantown, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8484253.png	\N	185	C/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9655	9655	\N	\N
5505	david-gagnon	David Gagnon	F	300	8485732	\N	\N	\N	\N	2000-04-19	Halifax, Nova Scotia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8485732.png	L	181	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10778	10778	\N	\N
5590	ethan-frisch	Ethan Frisch	D	311	8484246	\N	\N	\N	\N	2000-10-29	Moorhead, Minnesota, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8484246.png	R	192	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9651	9651	\N	\N
5361	lleyton-moore	Lleyton Moore	D	323	8483003	\N	\N	\N	\N	2002-02-27	Saskatoon, Saskatchewan, CAN	5'8"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8483003.png	L	178	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9216	9216	\N	\N
5713	ben-strinden	Ben Strinden	R	312	8483707	\N	\N	\N	\N	2002-06-04	Fargo, North Dakota, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8483707.png	R	204	C/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11078	11078	\N	\N
5312	nikita-prishchepov	Nikita Prishchepov	F	303	8485105	\N	831667	2027	1	2004-02-20	Orenburg, RUS	6'1"	https://assets.nhle.com/mugs/nhl/20262027/COL/8485105.png	L	194	C	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10257	10257	\N	\N
5237	michael-callahan	Michael Callahan	D	329	8480828	\N	850000	2027	1	1999-09-23	Franklin, Massachusetts, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8480828.png	L	195	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9032	9032	\N	michael-callahan
5053	eduard-sale	Eduard Sale	F	302	8484222	\N	950000	2028	2	2005-03-10	Brno, CZE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8484222.png	L	174	RW	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10184	10184	\N	\N
5327	gleb-trikozov	Gleb Trikozov	L	300	8483519	\N	887500	2027	1	2004-08-12	Omsk, RUS	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8483519.png	R	201	LW	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10466	10466	\N	\N
5387	adam-ginning	Adam Ginning	D	329	8480874	\N	875000	2028	2	2000-01-13	Linkoping, SWE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8480874.png	L	196	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9484	9484	\N	adam-ginning
5006	jared-wright	Jared Wright	F	313	8483756	\N	905000	2027	1	2002-11-22	Burnsville, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8483756.png	R	178	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10623	10623	\N	\N
5446	jack-matier	Jack Matier	D	329	8482808	\N	838333	2026	0	2003-04-08	Sault Ste. Marie, Ontario, CAN	6'6"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8482808.png	R	205	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9757	9757	\N	jack-matier
5073	boris-katchouk	Boris Katchouk	L	329	8479383	\N	775000	2026	0	1998-06-18	Vancouver, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8479383.png	L	212	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6779	6779	\N	boris-katchouk
4966	derrick-pouliot	Derrick Pouliot	D	329	8476884	\N	812500	2027	1	1994-01-16	Estevan, Saskatchewan, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8476884.png	L	198	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4957	4957	\N	derrick-pouliot
5464	andrew-basha	Andrew Basha	L	298	8484782	\N	997500	2029	3	2005-11-08	Calgary, Alberta, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8484782.png	L	174	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10753	10753	\N	\N
5091	arshdeep-bains	Arshdeep Bains	L	329	8483395	\N	812500	2027	1	2001-01-09	Surrey, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8483395.png	L	184	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9554	9554	\N	arshdeep-bains
5024	travis-boyd	Travis Boyd	F	329	8476329	\N	775000	2026	0	1993-09-14	Hopkins, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8476329.png	R	190	C/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5918	5918	\N	travis-boyd
5437	brandon-hickey	Brandon Hickey	D	306	8477995	\N	925000	2020	0	1996-04-13	Edmonton, Alberta, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8477995.png	L	200	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7444	7444	\N	\N
5723	christian-felton	Christian Felton	D	295	8484815	\N	870000	2025	0	2000-02-04	Medina, Ohio, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8484815.png	R	185	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10029	10029	\N	\N
4955	kasper-halttunen	Kasper Halttunen	F	318	8484176	\N	940000	2028	2	2005-06-07	Helsinki, FIN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8484176.png	R	215	RW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10231	10231	\N	\N
5572	riley-kidney	Riley Kidney	C	329	8482828	\N	859167	2026	0	2003-03-25	Halifax, Nova Scotia, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8482828.png	L	190	C/LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9180	9180	\N	riley-kidney
5640	cameron-butler	Cameron Butler	R	308	8483045	\N	850000	2027	1	2002-06-09	Ottawa, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8483045.png	R	215	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9715	9715	\N	\N
5107	taylor-makar	Taylor Makar	F	329	8482953	\N	875000	2028	2	2001-03-13	Calgary, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/COL/8482953.png	L	190	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10561	10561	\N	taylor-makar
5416	dalton-bancroft	Dalton Bancroft	R	329	8485496	\N	950000	2026	0	2001-02-26	Madoc, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8485496.png	R	212	LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10584	10584	\N	dalton-bancroft
5734	dyllan-gill	Dyllan Gill	D	320	8483692	\N	895000	2027	1	2004-06-07	Riverview, New Brunswick, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8483692.png	R	194	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10393	10393	\N	\N
5472	josh-jacobs	Josh Jacobs	D	309	8477972	\N	\N	\N	\N	1996-02-15	Shelby Township, Michigan, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8477972.png	R	200	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6337	6337	\N	\N
5673	marcel-marcel	Marcel Marcel	F	316	8484420	\N	\N	\N	\N	2003-10-31	Pilsen, CZE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8484420.png	L	242	LW	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9839	9839	\N	\N
5733	dillan-bentley	Dillan Bentley	F	309	8486119	\N	\N	\N	\N	2001-03-31	Peoria, Illinois, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8486119.png	R	192	C/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10983	10983	\N	\N
5155	riese-gaber	Riese Gaber	F	299	8484920	\N	\N	\N	\N	1999-10-10	Gilbert Plains, Manitoba, CAN	5'8"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8484920.png	R	163	LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10110	10110	\N	\N
4979	skyler-brind-amour	Skyler Brind'amour	F	329	8480291	\N	775000	2026	0	1999-07-27	Raleigh, North Carolina, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8480291.png	L	195	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9742	9742	\N	skyler-brind-amour
5512	jaxon-nelson	Jaxon Nelson	F	308	8484899	\N	870000	2025	0	2000-03-30	Magnolia, Minnesota, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8484899.png	R	215	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10094	10094	\N	\N
5005	jack-studnicka	Jack Studnicka	F	329	8480021	\N	875000	2028	2	1999-02-18	Windsor, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8480021.png	R	187	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7106	7106	\N	jack-studnicka
5661	jakub-demek	Jakub Demek	F	306	8482933	\N	850000	2027	1	2003-06-06	Kosice, SVK	6'4"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8482933.png	L	215	RW	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9269	9269	\N	\N
5448	josh-filmon	Josh Filmon	F	324	8483439	\N	870000	2027	1	2004-03-18	Winnipeg, Manitoba, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8483439.png	L	158	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9681	9681	\N	\N
5474	kevin-connauton	Kevin Connauton	D	329	8475246	\N	775000	2026	0	1990-02-23	Edmonton, Alberta, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8475246.png	L	205	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=3697	3697	\N	kevin-connauton
10758	filip-hallander	Filip Hallander	L	329	8480842	\N	812500	2027	1	2000-06-29	Sundsvall, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8480842.png	L	203	C	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8892	8892	\N	filip-hallander
10420	bokondji-imama	Bokondji Imama	L	329	8478147	\N	850000	2027	1	1996-08-03	Montréal, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8478147.png	L	223	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6865	6865	\N	bokondji-imama
10115	joona-koppanen	Joona Koppanen	C	329	8479533	\N	775000	2026	0	1998-02-25	Tampere, FIN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8479533.png	L	216	LW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7017	7017	\N	joona-koppanen
4927	brendan-brisson	Brendan Brisson	F	329	8482153	\N	775000	2026	0	2001-10-22	Los Angeles, California, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8482153.png	L	188	LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9119	9119	\N	brendan-brisson
10675	brandon-buhr	Brandon Buhr	F	322	8486129	\N	975000	2027	1	2002-07-07	Burnaby, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8486129.png	R	205	C/LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10992	10992	\N	\N
5325	cole-clayton	Cole Clayton	D	329	8482839	\N	850000	2027	1	2000-02-29	Strathmore, Alberta, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8482839.png	R	198	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8916	8916	\N	cole-clayton
5567	niko-huuhtanen	Niko Huuhtanen	R	329	8482757	\N	892500	2027	1	2003-06-26	Espoo, FIN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8482757.png	R	200	LW/RW	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9171	9171	\N	niko-huuhtanen
5270	keaton-middleton	Keaton Middleton	D	329	8479387	\N	812500	2027	1	1998-02-10	Edmonton, Alberta, CAN	6'6"	https://assets.nhle.com/mugs/nhl/20262027/COL/8479387.png	L	240	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7218	7218	\N	keaton-middleton
5378	jake-furlong	Jake Furlong	D	318	8483745	\N	870833	2027	1	2004-03-04	Labrador City, Newfoundland and Labrador, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8483745.png	L	189	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9259	9259	\N	\N
9953	rafael-harvey-pinard	Rafael Harvey-pinard	L	329	8481093	\N	775000	2026	0	1999-01-06	Saguenay, Quebec, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8481093.png	L	179	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7802	7802	\N	rafael-harvey-pinard
5117	gracyn-sawchyn	Gracyn Sawchyn	C	299	8484224	\N	878333	2028	2	2005-01-19	Grande Prairie, Alberta, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8484224.png	R	157	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10087	10087	\N	\N
4963	antonio-stranges	Antonio Stranges	F	329	8482120	\N	775000	2026	0	2002-02-05	Plymouth, Michigan, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8482120.png	L	187	C/LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8459	8459	\N	antonio-stranges
92	florian-xhekaj	Florian Xhekaj	C	309	8484403	63	941667	2027	1	2004-06-27	Hamilton, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8484403.png	L	195	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10139	10139	\N	\N
5560	mason-geertsen	Mason Geertsen	L	329	8477419	\N	812500	2027	1	1995-04-19	Drayton Valley, Alberta, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8477419.png	L	231	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5475	5475	\N	mason-geertsen
5092	austin-watson	Austin Watson	R	329	8475766	\N	775000	2026	0	1992-01-13	Ann Arbor, Michigan, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/DET/8475766.png	R	203	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4085	4085	\N	austin-watson
4814	martin-frk	Martin Frk	R	298	8476924	\N	775000	2025	0	1993-10-05	Pelhrimov, CZE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8476924.png	R	210	LW/RW	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5018	5018	\N	\N
5729	darick-louis-jean	Darick Louis-jean	D	309	8485193	\N	\N	\N	\N	2000-12-07	Montréal, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8485193.png	L	196	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10781	10781	\N	\N
5297	ashton-sautner	Ashton Sautner	D	311	8477085	\N	\N	\N	\N	1994-05-27	Flin Flon, Manitoba, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8477085.png	L	192	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5929	5929	\N	\N
10910	sean-larochelle	Sean Larochelle	D	311	8481790	\N	\N	\N	\N	2001-02-11	Longueuil, Quebec, CAN	5'9"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8481790.png	R	165	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10969	10969	\N	\N
5493	andrew-perrott	Andrew Perrott	D	316	8481861	\N	\N	\N	\N	2001-08-24	Westlake, Ohio, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8481861.png	R	217	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9341	9341	\N	\N
5668	keaton-mastrodonato	Keaton Mastrodonato	F	313	8484276	\N	\N	\N	\N	1999-02-13	Powell River, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8484276.png	R	205	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9663	9663	\N	\N
5289	hunter-st-martin	Hunter St. Martin	F	299	8485071	\N	855833	2028	2	2005-06-13	Edmonton, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8485071.png	L	174	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10915	10915	\N	\N
10909	scott-reedy	Scott Reedy	F	326	8480060	\N	775000	2024	0	1999-04-04	Prior Lake, Minnesota, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8480060.png	R	204	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8693	8693	\N	\N
5482	quinton-burns	Quinton Burns	D	319	8484151	\N	870000	2028	2	2005-04-14	Smith Falls, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/STL/8484151.png	L	206	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10843	10843	\N	\N
5551	john-prokop	John Prokop	D	329	8485459	\N	875000	2026	0	2001-05-13	Wausau, Wisconsin, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8485459.png	L	195	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10513	10513	\N	john-prokop
55	hunter-haight	Hunter Haight	F	308	8483452	37	897500	2027	1	2004-04-04	Strathroy, Ontario, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8483452.png	R	173	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10313	10313	\N	\N
5587	cooper-gay	Cooper Gay	F	303	8485474	\N	910000	2027	1	2002-03-15	Edina, Minnesota, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/COL/8485474.png	L	209	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10545	10545	\N	\N
5471	jacob-perreault	Jacob Perreault	R	314	8482150	\N	925000	2025	0	2002-04-15	Montréal, Quebec, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8482150.png	R	185	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8386	8386	\N	\N
465	ville-heinola	Ville Heinola	D	311	8481572	14	850000	2027	1	2001-03-02	Honkajoki, FIN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8481572.png	L	181	D	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7772	7772	\N	\N
5333	lukas-dragicevic	Lukas Dragicevic	D	302	8484162	\N	923333	2028	2	2005-04-25	Richmond, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8484162.png	R	206	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10082	10082	\N	\N
4874	tyson-jugnauth	Tyson Jugnauth	D	302	8483684	\N	950000	2028	2	2004-04-17	Toronto, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8483684.png	L	183	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10190	10190	\N	\N
13	josh-samanski	Josh Samanski	C	296	8484509	81	975000	2027	1	2002-03-22	Erding, DEU	6'2"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8484509.png	L	195	C	DEU	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10877	10877	\N	\N
5055	gavin-hayes	Gavin Hayes	F	316	8483453	\N	896667	2027	1	2004-05-14	Ypsilanti, Michigan, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8483453.png	R	177	LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9720	9720	\N	\N
5454	michael-milne	Michael Milne	F	329	8482829	\N	775000	2026	0	2002-09-21	Abbotsford, British Columbia, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/DET/8482829.png	L	185	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9347	9347	\N	michael-milne
5135	david-edstrom	David Edstrom	C	312	8484165	\N	950000	2028	2	2005-02-18	Gothenburg, SWE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8484165.png	L	193	C	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10645	10645	\N	\N
5106	patrick-giles	Patrick Giles	F	329	8480825	\N	875000	2028	2	2000-01-03	Chevy Chase, Maryland, USA	6'5"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8480825.png	R	218	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9040	9040	\N	patrick-giles
4827	patrick-brown	Patrick Brown	F	329	8477887	\N	775000	2026	0	1992-05-29	Bloomfield Hills, Michigan, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8477887.png	R	217	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5721	5721	\N	patrick-brown
630	zayne-parekh	Zayne Parekh	D	298	8484768	19	975000	2028	2	2006-02-15	Markham, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8484768.png	R	179	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10953	10953	\N	\N
5039	filip-mesar	Filip Mesar	R	309	8483488	\N	950000	2027	1	2004-01-03	Kezmarok, SVK	5'10"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8483488.png	R	184	RW	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9522	9522	\N	\N
5062	lucas-carlsson	Lucas Carlsson	D	329	8479523	\N	800000	2026	0	1997-07-05	Gavle, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8479523.png	L	190	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7434	7434	\N	lucas-carlsson
5208	seamus-casey	Seamus Casey	D	324	8483429	\N	950000	2027	1	2004-01-08	Miami, Florida, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8483429.png	R	181	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10474	10474	\N	\N
5057	jackson-hallum	Jackson Hallum	F	306	8482512	\N	933750	2027	1	2002-09-08	Eagan, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8482512.png	L	190	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10680	10680	\N	\N
5465	cooper-walker	Cooper Walker	C	295	8482969	\N	\N	\N	\N	2002-07-11	Cambridge, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8482969.png	R	174	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10013	10013	\N	\N
5379	jujhar-khaira	Jujhar Khaira	C	295	8476915	\N	\N	\N	\N	1994-08-13	Surrey, British Columbia, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8476915.png	L	212	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5502	5502	\N	\N
5499	chad-hillebrand	Chad Hillebrand	L	304	8484921	\N	\N	\N	\N	1999-01-22	Park Ridge, Illinois, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/DET/8484921.png	L	201	C/LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10108	10108	\N	\N
13149	michael-bunting	Michael Bunting	LW	329	8478047	\N	4500000	2026	0	1995-09-17	Scarborough, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8478047.png	L	186	LW/RW	CAN	https://frozenpool.dobbersports.com/players/michael-bunting	\N	\N	michael-bunting
13230	evgenii-dadonov	Evgenii Dadonov	RW	329	8474149	\N	1000000	2026	0	1989-03-12	Chelyabinsk, RUS	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8474149.png	L	188	LW/RW	RUS	https://frozenpool.dobbersports.com/players/evgenii-dadonov	\N	\N	evgenii-dadonov
13161	reilly-smith	Reilly Smith	RW	329	8475191	\N	2000000	2026	0	1991-04-01	Mimico, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8475191.png	L	185	LW/RW	CAN	https://frozenpool.dobbersports.com/players/reilly-smith	\N	\N	reilly-smith
13133	patrick-kane	Patrick Kane	RW	329	8474141	\N	3000000	2026	0	1988-11-19	Buffalo, New York, USA	5'10"	https://assets.nhle.com/mugs/nhl/20262027/DET/8474141.png	L	176	RW	USA	https://frozenpool.dobbersports.com/players/patrick-kane	\N	\N	patrick-kane
13159	john-klingberg	John Klingberg	D	329	8475906	\N	4000000	2026	0	1992-08-14	Gothenburg, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8475906.png	R	185	D	SWE	https://frozenpool.dobbersports.com/players/john-klingberg	\N	\N	john-klingberg
5148	joe-hicketts	Joe Hicketts	D	329	8478176	\N	812500	2027	1	1996-05-04	Kamloops, British Columbia, CAN	5'8"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8478176.png	L	176	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5976	5976	\N	joe-hicketts
13232	patrik-laine	Patrik Laine	RW	329	8479339	\N	8700000	2026	0	1998-04-19	Tampere, FIN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8479339.png	R	208	LW/RW	FIN	https://frozenpool.dobbersports.com/players/patrik-laine	\N	\N	patrik-laine
13189	carson-soucy	Carson Soucy	D	329	8477369	\N	3250000	2026	0	1994-07-27	Viking, Alberta, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8477369.png	L	211	D	CAN	https://frozenpool.dobbersports.com/players/carson-soucy	\N	\N	carson-soucy
13250	derek-forbort	Derek Forbort	D	329	8475762	\N	2000000	2026	0	1992-03-04	Duluth, Minnesota, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8475762.png	L	216	D	USA	https://frozenpool.dobbersports.com/players/derek-forbort	\N	\N	derek-forbort
526	james-hamblin	James Hamblin	C	329	8480468	\N	875000	2028	2	1999-04-27	Edmonton, Alberta, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8480468.png	L	185	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8485	8485	\N	james-hamblin
13207	zachary-l-heureux	Zachary L'Heureux	LW	22	8482742	\N	875000	2028	2	2003-05-15	Montréal, Quebec, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8482742.png	L	197	C/LW	CAN	https://frozenpool.dobbersports.com/players/zachary-l-heureux	\N	\N	\N
13170	jonny-brodzinski	Jonny Brodzinski	C	329	8477380	\N	850000	2027	1	1993-06-19	Ham Lake, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8477380.png	R	206	C/RW	USA	https://frozenpool.dobbersports.com/players/jonny-brodzinski	\N	\N	jonny-brodzinski
13174	adam-henrique	Adam Henrique	C	329	8474641	\N	3000000	2026	0	1990-02-06	Brantford, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8474641.png	L	195	C/LW	CAN	https://frozenpool.dobbersports.com/players/adam-henrique	\N	\N	adam-henrique
13199	kevin-hayes	Kevin Hayes	RW	329	8475763	\N	7142857	2026	0	1992-05-08	Dorchester, Massachusetts, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8475763.png	L	217	C/LW/RW	USA	https://frozenpool.dobbersports.com/players/kevin-hayes	\N	\N	kevin-hayes
4877	bogdan-trineyev	Bogdan Trineyev	R	307	8482167	\N	900000	2028	2	2002-03-04	Voronezh, RUS	6'3"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8482167.png	R	198	LW	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9161	9161	\N	\N
13262	jacob-moverare	Jacob Moverare	D	329	8479421	\N	775000	2026	0	1998-08-31	Ostersund, SWE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8479421.png	L	205	D	SWE	https://frozenpool.dobbersports.com/players/jacob-moverare	\N	\N	jacob-moverare
5496	brandon-baddock	Brandon Baddock	L	322	8477631	\N	750000	2023	0	1995-03-29	Vermilion, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8477631.png	L	218	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5926	5926	\N	\N
4893	matthew-poitras	Matthew Poitras	C	314	8483505	\N	870000	2026	0	2004-03-10	Whitby, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8483505.png	R	189	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9729	9729	\N	\N
13191	rodrigo-abols	Rodrigo Abols	C	329	8479022	\N	800000	2026	0	1996-01-05	Riga, LVA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8479022.png	L	206	C/LW	LVA	https://frozenpool.dobbersports.com/players/rodrigo-abols	\N	\N	rodrigo-abols
4818	bradly-nadeau	Bradly Nadeau	F	300	8484203	\N	950000	2027	1	2005-05-05	St-Francois de Madaw, New Brunswick, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/CAR/8484203.png	R	180	C/LW/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10468	10468	\N	\N
4822	mitchell-chaffee	Mitchell Chaffee	R	329	8482070	\N	850000	2027	1	1998-01-26	Grand Rapids, Michigan, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8482070.png	R	197	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8553	8553	\N	mitchell-chaffee
13166	jonathan-drouin	Jonathan Drouin	LW	329	8477494	\N	4000000	2028	2	1995-03-28	Ste-Agathe, Quebec, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NYI/8477494.png	L	189	C/LW/RW	CAN	https://frozenpool.dobbersports.com/players/jonathan-drouin	\N	\N	jonathan-drouin
13175	ben-hutton	Ben Hutton	D	329	8477018	\N	975000	2026	0	1993-04-20	Brockville, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8477018.png	L	209	D	CAN	https://frozenpool.dobbersports.com/players/ben-hutton	\N	\N	ben-hutton
490	martin-fehrvry	Martin Fehérváry	D	37	8480796	42	\N	\N	\N	1999-10-06	Bratislava, SVK	6'2"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8480796.png	L	215	D	SVK	\N	\N	\N	\N
5119	jake-schmaltz	Jake Schmaltz	C	314	8481681	\N	\N	\N	\N	2001-04-24	McFarland, Wisconsin, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8481681.png	L	167	C/LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10541	10541	\N	\N
261	ben-kindel	Ben Kindel	C	28	8485414	81	\N	\N	\N	2007-04-19	Coquitlam, British Columbia, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8485414.png	R	182	C	CAN	\N	\N	\N	\N
5226	anthony-vincent	Anthony Vincent	F	318	8484123	\N	\N	\N	\N	1997-08-12	Wilton, Connecticut, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8484123.png	R	190	C/LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9621	9621	\N	\N
5144	brett-berard	Brett Berard	F	305	8482132	\N	850000	2027	1	2002-09-09	Providence, Rhode Island, USA	5'9"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8482132.png	L	175	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9642	9642	\N	\N
5165	marc-andre-gaudet	Marc-andre Gaudet	D	319	8483764	\N	849167	2027	1	2003-10-24	Moncton, New Brunswick, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/STL/8483764.png	L	196	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9868	9868	\N	\N
5417	dalton-smith	Dalton Smith	L	307	8475748	\N	700000	2020	0	1992-06-30	Markham, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8475748.png	L	206	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4604	4604	\N	\N
5486	tyler-kopff	Tyler Kopff	L	315	8485470	\N	975000	2027	1	2003-04-22	Ridgewood, New Jersey, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8485470.png	L	216	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10544	10544	\N	\N
462	dylan-coghlan	Dylan Coghlan	D	329	8479639	52	875000	2028	2	1998-02-19	Duncan, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8479639.png	R	205	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7267	7267	\N	dylan-coghlan
5236	luke-toporowski	Luke Toporowski	R	303	8481866	\N	870000	2025	0	2001-04-12	Davenport, Iowa, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/COL/8481866.png	L	181	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7782	7782	\N	\N
614	ben-jones	Ben Jones	C	329	8480259	64	850000	2027	1	1999-02-26	Waterloo, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8480259.png	L	187	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7653	7653	\N	ben-jones
437	jamie-oleksiak	Jamie Oleksiak	D	329	8476467	\N	5000000	2028	2	1992-12-21	Toronto, Ontario, CAN	6'7"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8476467.png	L	252	D	CAN	\N	\N	\N	jamie-oleksiak
529	jeff-malott	Jeff Malott	L	329	8482408	\N	1850000	2029	3	1996-08-07	Burlington, Ontario, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8482408.png	L	215	LW	CAN	\N	\N	\N	jeff-malott
4828	riley-tufte	Riley Tufte	L	329	8479362	\N	850000	2027	1	1998-04-10	Coon Rapids, Minnesota, USA	6'6"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8479362.png	L	233	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7943	7943	\N	riley-tufte
727	colin-blackwell	Colin Blackwell	C	329	8476278	15	812500	2027	1	1993-03-28	North Andover, Massachusetts, USA	5'8"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8476278.png	R	181	C	USA	\N	\N	\N	colin-blackwell
43	brian-dumoulin	Brian Dumoulin	D	329	8475208	2	4000000	2028	2	1991-09-06	Biddeford, Maine, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8475208.png	L	215	D	USA	\N	\N	\N	brian-dumoulin
4917	calle-rosen	Calle Rosen	D	329	8480157	\N	875000	2028	2	1994-02-02	Vaxjo, SWE	6'1"	https://assets.nhle.com/mugs/nhl/20262027/STL/8480157.png	L	188	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6917	6917	\N	calle-rosen
4930	dylan-gambrell	Dylan Gambrell	C	329	8479580	\N	850000	2027	1	1996-08-26	Bonney Lake, Washington, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8479580.png	R	191	C/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7428	7428	\N	dylan-gambrell
552	james-hagens	James Hagens	F	314	8485395	44	975000	2028	2	2006-11-03	Hauppauge, New York, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/BOS/8485395.png	L	177	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11000	11000	\N	\N
13320	garin-bjorklund	GARIN BJORKLUND	G	329	8482188	\N	775000	2026	0	2002-05-28	Grande Prairie, Alberta, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8482188.png	L	195	\N	CAN	https://frozenpool.dobbersports.com/players/garin-bjorklund	\N	\N	garin-bjorklund
5147	jason-polin	Jason Polin	F	329	8484255	\N	850000	2027	1	1999-06-17	Holt, Michigan, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/COL/8484255.png	R	198	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9677	9677	\N	jason-polin
4812	filip-bystedt	Filip Bystedt	F	318	8483428	\N	950000	2027	1	2004-02-04	Norrkoping, SWE	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8483428.png	L	187	C	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10086	10086	\N	\N
5467	dennis-cholowski	Dennis Cholowski	D	329	8479395	\N	875000	2028	2	1998-02-15	Langley, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8479395.png	L	210	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6734	6734	\N	dennis-cholowski
5274	ryder-rolston	Ryder Rolston	F	329	8482082	\N	895000	2026	0	2001-10-31	Boston, Massachusetts, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8482082.png	R	175	C/LW/RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9622	9622	\N	ryder-rolston
5166	nathan-legare	Nathan Legare	R	329	8481594	\N	775000	2026	0	2001-01-11	Montréal, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/NJD/8481594.png	R	200	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8891	8891	\N	nathan-legare
233	tyson-foerster	Tyson Foerster	R	27	8482159	71	7100000	2035	9	2002-01-18	Alliston, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/PHI/8482159.png	R	215	RW	CAN	\N	\N	\N	\N
479	ryan-leonard	Ryan Leonard	R	37	8484186	9	950000	2027	1	2005-01-21	Northampton, Massachusetts, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8484186.png	R	205	RW	USA	\N	\N	\N	\N
5259	reese-johnson	Reese Johnson	R	322	8481147	\N	775000	2025	0	1998-07-10	Regina, Saskatchewan, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8481147.png	R	193	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7579	7579	\N	\N
5451	kyle-crnkovic	Kyle Crnkovic	F	318	8484594	\N	\N	\N	\N	2002-02-10	Calgary, Alberta, CAN	5'7"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8484594.png	L	165	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9808	9808	\N	\N
9989	gabe-klassen	Gabe Klassen	C	325	8483105	\N	\N	\N	\N	2003-06-30	Saskatoon, Saskatchewan, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/PIT/8483105.png	L	178	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9223	9223	\N	\N
5778	roman-kinal	Roman Kinal	D	317	8484130	\N	\N	\N	\N	1998-07-20	Waterford, Michigan, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8484130.png	L	190	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9625	9625	\N	\N
13343	ken-appleby	KEN APPLEBY	G	322	8478965	\N	\N	\N	\N	1995-04-10	North Bay, Ontario, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8478965.png	L	216	\N	CAN	https://frozenpool.dobbersports.com/players/ken-appleby	\N	\N	\N
13341	ethan-haider	ETHAN HAIDER	G	312	8481749	\N	\N	\N	\N	2001-09-04	St. Louis Park, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8481749.png	L	197	\N	USA	https://frozenpool.dobbersports.com/players/ethan-haider	\N	\N	\N
13265	victor-ostman	Victor Ostman	G	329	8484910	\N	850000	2027	1	2000-10-03	Danderyd, SWE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8484910.png	L	205	\N	SWE	https://frozenpool.dobbersports.com/players/victor-ostman	\N	\N	victor-ostman
538	tyson-hinds	Tyson Hinds	D	317	8482731	60	900000	2028	2	2003-03-12	Gatineau, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/ANA/8482731.png	L	201	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9193	9193	\N	\N
445	braeden-bowman	Braeden Bowman	F	306	8483890	42	875000	2027	1	2003-06-26	Kitchener, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8483890.png	R	205	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9250	9250	\N	\N
5211	dylan-anhorn	Dylan Anhorn	D	329	8484906	\N	850000	2027	1	1999-01-21	Calgary, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8484906.png	L	190	D	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10112	10112	\N	dylan-anhorn
13280	kaapo-kahkonen	KAAPO KAHKONEN	G	329	8478039	\N	1000000	2027	1	1996-08-16	Helsinki, FIN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8478039.png	L	217	\N	FIN	https://frozenpool.dobbersports.com/players/kaapo-kahkonen	\N	\N	kaapo-kahkonen
5203	jordan-dumais	Jordan Dumais	R	301	8483688	\N	923333	2027	1	2004-04-15	Montréal, Quebec, CAN	5'8"	https://assets.nhle.com/mugs/nhl/20262027/CBJ/8483688.png	R	173	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10488	10488	\N	\N
757	dylan-larkin	Dylan Larkin	C	16	8477946	71	8700000	2031	5	1996-07-30	Waterford, Michigan, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/DET/8477946.png	L	204	C	USA	\N	\N	\N	\N
13308	jesper-vikman	JESPER VIKMAN	G	329	8482484	\N	858000	2026	0	2002-03-11	Danderyd, SWE	6'4"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8482484.png	L	205	\N	SWE	https://frozenpool.dobbersports.com/players/jesper-vikman	\N	\N	jesper-vikman
13330	michael-hrabal	MICHAEL HRABAL	G	323	8484181	\N	1075000	2029	3	2005-01-20	Prague, CZE	6'6"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8484181.png	L	209	\N	CZE	https://frozenpool.dobbersports.com/players/michael-hrabal	\N	\N	\N
13241	artur-akhtyamov	Artur Akhtyamov	G	329	8482515	\N	900000	2029	3	2001-10-31	Kazan, RUS	6'2"	https://assets.nhle.com/mugs/nhl/20262027/TOR/8482515.png	L	176	\N	RUS	https://frozenpool.dobbersports.com/players/artur-akhtyamov	\N	\N	artur-akhtyamov
13302	louis-domingue	LOUIS DOMINGUE	G	329	8475839	\N	775000	2026	0	1992-03-06	St-Hyacinthe, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8475839.png	R	207	\N	CAN	https://frozenpool.dobbersports.com/players/louis-domingue	\N	\N	louis-domingue
4922	lleyton-roed	Lleyton Roed	F	302	8484891	\N	850000	2027	1	2002-08-08	White Bear Lake, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8484891.png	L	179	LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10083	10083	\N	\N
5162	cam-dineen	Cam Dineen	D	329	8479341	\N	875000	2028	2	1998-06-19	Toms River, New Jersey, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/EDM/8479341.png	L	188	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7159	7159	\N	cam-dineen
5192	connor-mackey	Connor Mackey	D	329	8482067	\N	937500	2028	2	1996-09-12	Tower Lakes, Illinois, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/NYR/8482067.png	L	205	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8622	8622	\N	connor-mackey
13293	cal-petersen	CAL PETERSEN	G	329	8477361	\N	775000	2026	0	1994-10-19	Waterloo, Iowa, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8477361.png	R	185	\N	USA	https://frozenpool.dobbersports.com/players/cal-petersen	\N	\N	cal-petersen
5043	mitchell-stephens	Mitchell Stephens	F	329	8478477	\N	775000	2026	0	1997-02-05	Peterborough, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8478477.png	R	203	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6306	6306	\N	mitchell-stephens
13245	drew-commesso	Drew Commesso	G	12	8482123	\N	875000	2028	2	2002-07-19	Norwell, Massachusetts, USA	6'2"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8482123.png	L	180	\N	USA	https://frozenpool.dobbersports.com/players/drew-commesso	\N	\N	\N
5181	jakub-stancl	Jakub Stancl	F	319	8484229	\N	866667	2028	2	2005-04-10	Prague, CZE	6'3"	https://assets.nhle.com/mugs/nhl/20262027/STL/8484229.png	L	217	C	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10532	10532	\N	\N
415	andrew-peeke	Andrew Peeke	D	329	8479369	\N	1000000	2027	1	1998-03-17	Parkland, Florida, USA	6'3"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8479369.png	R	214	D	USA	\N	\N	\N	andrew-peeke
13310	carter-gylander	CARTER GYLANDER	G	304	8481757	\N	855000	2026	0	2001-06-05	Edmonton, Alberta, CAN	6'5"	https://assets.nhle.com/mugs/nhl/20262027/DET/8481757.png	L	197	\N	CAN	https://frozenpool.dobbersports.com/players/carter-gylander	\N	\N	\N
13317	jackson-parsons	JACKSON PARSONS	G	297	8485142	\N	879167	2028	2	2004-11-23	Ottawa, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8485142.png	L	203	\N	CAN	https://frozenpool.dobbersports.com/players/jackson-parsons	\N	\N	\N
13269	james-reimer	James Reimer	G	329	8473503	\N	850000	2026	0	1988-03-15	Morweena, Manitoba, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/OTT/8473503.png	L	200	\N	CAN	https://frozenpool.dobbersports.com/players/james-reimer	\N	\N	james-reimer
13334	kevin-mandolese	KEVIN MANDOLESE	G	320	8480867	\N	775000	2025	0	2000-08-22	Blainville, Quebec, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8480867.png	L	180	\N	CAN	https://frozenpool.dobbersports.com/players/kevin-mandolese	\N	\N	\N
13279	matthew-murray	MATTHEW MURRAY	G	312	8483575	\N	\N	\N	\N	1998-02-02	St. Albert, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8483575.png	L	196	\N	CAN	https://frozenpool.dobbersports.com/players/matthew-murray	\N	\N	\N
13283	nikke-kokko	NIKKE KOKKO	G	302	8483668	\N	\N	\N	\N	2004-03-14	Oulu, FIN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8483668.png	L	184	\N	FIN	https://frozenpool.dobbersports.com/players/nikke-kokko	\N	\N	\N
5353	jack-ricketts	Jack Ricketts	F	323	8485772	\N	\N	\N	\N	1999-09-08	Oakville, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/UTA/8485772.png	L	194	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10670	10670	\N	\N
13346	jonathan-lemieux	JONATHAN LEMIEUX	G	295	8483800	\N	\N	\N	\N	2001-06-08	Saint-Hyacinthe, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8483800.png	L	185	\N	CAN	https://frozenpool.dobbersports.com/players/jonathan-lemieux	\N	\N	\N
13342	logan-terness	LOGAN TERNESS	G	302	8485536	\N	\N	\N	\N	2002-09-18	Burnaby, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8485536.png	L	174	\N	CAN	https://frozenpool.dobbersports.com/players/logan-terness	\N	\N	\N
5420	graham-slaggert	Graham Slaggert	L	315	8483563	\N	\N	\N	\N	1999-04-06	South Bend, Indiana, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8483563.png	L	183	C	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9078	9078	\N	\N
5694	simon-pinard	Simon Pinard	F	307	8483018	\N	\N	\N	\N	2001-05-26	Drummondville, Quebec, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/WSH/8483018.png	L	190	LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9957	9957	\N	\N
5299	braden-hache	Braden Hache	D	318	8482901	\N	\N	\N	\N	2003-05-21	Manchester, New Hampshire, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/SJS/8482901.png	L	200	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9177	9177	\N	\N
13299	arno-tiefensee	ARNO TIEFENSEE	G	321	8484442	\N	887500	2027	1	2002-05-01	Weißwasser, DEU	6'4"	https://assets.nhle.com/mugs/nhl/20262027/DAL/8484442.png	L	217	\N	DEU	https://frozenpool.dobbersports.com/players/arno-tiefensee	\N	\N	\N
13309	samuel-hlavaj	SAMUEL HLAVAJ	G	329	8482085	\N	850000	2027	1	2001-05-29	Martin, SVK	6'4"	https://assets.nhle.com/mugs/nhl/20262027/MIN/8482085.png	L	218	\N	SVK	https://frozenpool.dobbersports.com/players/samuel-hlavaj	\N	\N	samuel-hlavaj
307	ben-meyers	Ben Meyers	F	329	8483570	59	1000000	2028	2	1998-11-15	Delano, Minnesota, USA	5'11"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8483570.png	L	194	C/LW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9225	9225	\N	ben-meyers
13322	jack-lafontaine	JACK LAFONTAINE	G	302	8479581	\N	910909	2022	0	1998-01-06	Mississauga, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/SEA/8479581.png	L	204	\N	CAN	https://frozenpool.dobbersports.com/players/jack-lafontaine	\N	\N	\N
13318	ty-young	TY YOUNG	G	295	8483751	\N	850000	2027	1	2004-09-11	Calgary, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/VAN/8483751.png	L	181	\N	CAN	https://frozenpool.dobbersports.com/players/ty-young	\N	\N	\N
5102	koehn-ziemmer	Koehn Ziemmer	F	313	8484243	\N	875000	2028	2	2004-12-08	Mayerthorpe, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/LAK/8484243.png	R	202	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9785	9785	\N	\N
4974	joey-anderson	Joey Anderson	R	329	8479315	\N	800000	2026	0	1998-06-19	Roseville, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/20262027/CHI/8479315.png	R	207	RW	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7297	7297	\N	joey-anderson
5530	axel-sandin-pellikka	Axel Sandin-pellikka	D	304	8484223	\N	950000	2028	2	2005-03-11	Gallivare, SWE	6'0"	https://assets.nhle.com/mugs/nhl/20262027/DET/8484223.png	R	186	D	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10628	10628	\N	\N
13292	ryan-fanti	RYAN FANTI	G	329	8483534	\N	775000	2026	0	1999-10-03	Thunder Bay, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8483534.png	L	200	\N	CAN	https://frozenpool.dobbersports.com/players/ryan-fanti	\N	\N	ryan-fanti
345	conor-geekie	Conor Geekie	C	320	8483447	14	950000	2027	1	2004-05-05	Strathclair, Manitoba, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/TBL/8483447.png	L	212	C/RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9202	9202	\N	\N
13277	cooper-black	COOPER BLACK	G	329	8484900	\N	875000	2028	2	2001-06-14	Alpena, Michigan, USA	6'8"	https://assets.nhle.com/mugs/nhl/20262027/FLA/8484900.png	L	223	\N	USA	https://frozenpool.dobbersports.com/players/cooper-black	\N	\N	cooper-black
119	matthew-wood	Matthew Wood	L	312	8484241	71	950000	2027	1	2005-02-06	Nanaimo, British Columbia, CAN	6'4"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8484241.png	R	202	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10921	10921	\N	\N
13237	cam-talbot	Cam Talbot	G	329	8475660	\N	2500000	2026	0	1987-07-05	Caledonia, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/20262027/DET/8475660.png	L	202	\N	CAN	https://frozenpool.dobbersports.com/players/cam-talbot	\N	\N	cam-talbot
758	michael-rasmussen	Michael Rasmussen	C	329	8479992	27	3200000	2028	2	1999-04-17	Surrey, British Columbia, CAN	6'6"	https://assets.nhle.com/mugs/nhl/20262027/DET/8479992.png	L	222	C/LW	CAN	\N	\N	\N	michael-rasmussen
610	matvei-gridin	Matvei Gridin	F	298	8484860	92	975000	2028	2	2006-03-01	Kurgan, RUS	6'1"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8484860.png	L	182	RW	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10923	10923	\N	\N
13155	jonathan-toews	Jonathan Toews	C	38	8473604	\N	2000000	2026	0	1988-04-29	Winnipeg, Manitoba, CAN	6'2"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8473604.png	L	201	C	CAN	https://frozenpool.dobbersports.com/players/jonathan-toews	\N	\N	\N
4815	laurent-dauphin	Laurent Dauphin	F	309	8477460	\N	750000	2023	0	1995-03-27	Repentigny, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/20262027/MTL/8477460.png	L	186	C/LW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5927	5927	\N	\N
4892	mason-shaw	Mason Shaw	R	329	8479972	\N	850000	2027	1	1998-11-03	Lloydminster, Alberta, CAN	5'10"	https://assets.nhle.com/mugs/nhl/20262027/WPG/8479972.png	L	184	C	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7113	7113	\N	mason-shaw
542	travis-mitchell	Travis Mitchell	D	329	8484262	\N	850000	2027	1	1999-11-25	South Lyon, Michigan, USA	6'4"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8484262.png	L	203	D	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9689	9689	\N	travis-mitchell
4918	daniil-miromanov	Daniil Miromanov	D	329	8482624	\N	1250000	2026	0	1997-07-11	Moscow, RUS	6'4"	https://assets.nhle.com/mugs/nhl/20262027/CGY/8482624.png	R	207	D	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8729	8729	\N	daniil-miromanov
13358	alexandar-georgiev	ALEXANDAR GEORGIEV	G	329	8480382	\N	825000	2026	0	1996-02-10	Ruse, BGR	6'1"	https://assets.nhle.com/mugs/nhl/20262027/BUF/8480382.png	L	178	\N	BGR	https://frozenpool.dobbersports.com/players/alexandar-georgiev	\N	\N	alexandar-georgiev
13195	brandon-saad	Brandon Saad	LW	329	8476438	\N	2000000	2026	0	1992-10-27	Pittsburgh, Pennsylvania, USA	6'1"	https://assets.nhle.com/mugs/nhl/20262027/VGK/8476438.png	L	207	LW/RW	USA	https://frozenpool.dobbersports.com/players/brandon-saad	\N	\N	brandon-saad
10024	matthew-maggio	Matthew Maggio	F	329	8483062	\N	870000	2026	0	2002-11-25	Windsor, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8483062.png	R	194	RW	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9443	9443	\N	matthew-maggio
13165	nick-blankenburg	Nick Blankenburg	D	329	8483565	\N	775000	2026	0	1998-05-12	Washington, Michigan, USA	5'9"	https://assets.nhle.com/mugs/nhl/20262027/NSH/8483565.png	R	177	D	USA	https://frozenpool.dobbersports.com/players/nick-blankenburg	\N	\N	nick-blankenburg
\.


--
-- Data for Name: Team; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Team" (id, slug, name, gm, arena, code, league, "parentTeamId", "eliteProspectsUrl", "logoUrl") FROM stdin;
18	florida-panthers	Florida Panthers	Unassigned	Amerant Bank Arena	FLA	NHL	\N	\N	\N
19	los-angeles-kings	Los Angeles Kings	Unassigned	Crypto.com Arena	LAK	NHL	\N	\N	\N
20	minnesota-wild	Minnesota Wild	Unassigned	Xcel Energy Center	MIN	NHL	\N	\N	\N
21	montreal-canadiens	Montreal Canadiens	Unassigned	Bell Centre	MTL	NHL	\N	\N	\N
22	nashville-predators	Nashville Predators	Unassigned	Bridgestone Arena	NSH	NHL	\N	\N	\N
23	new-jersey-devils	New Jersey Devils	Unassigned	Prudential Center	NJD	NHL	\N	\N	\N
24	new-york-islanders	New York Islanders	Unassigned	UBS Arena	NYI	NHL	\N	\N	\N
25	new-york-rangers	New York Rangers	Unassigned	Madison Square Garden	NYR	NHL	\N	\N	\N
26	ottawa-senators	Ottawa Senators	Unassigned	Canadian Tire Centre	OTT	NHL	\N	\N	\N
27	philadelphia-flyers	Philadelphia Flyers	Unassigned	Wells Fargo Center	PHI	NHL	\N	\N	\N
28	pittsburgh-penguins	Pittsburgh Penguins	Unassigned	PPG Paints Arena	PIT	NHL	\N	\N	\N
29	san-jose-sharks	San Jose Sharks	Unassigned	SAP Center	SJS	NHL	\N	\N	\N
30	seattle-kraken	Seattle Kraken	Unassigned	Climate Pledge Arena	SEA	NHL	\N	\N	\N
31	st-louis-blues	St. Louis Blues	Unassigned	Enterprise Center	STL	NHL	\N	\N	\N
32	tampa-bay-lightning	Tampa Bay Lightning	Unassigned	Amalie Arena	TBL	NHL	\N	\N	\N
2	toronto-maple-leafs	Toronto Maple Leafs	Unknown	Scotiabank Arena	TOR	NHL	\N	\N	\N
34	utah-mammoth	Utah Mammoth	Unassigned	Delta Center	UTA	NHL	\N	\N	\N
35	vancouver-canucks	Vancouver Canucks	Unassigned	Rogers Arena	VAN	NHL	\N	\N	\N
36	vegas-golden-knights	Vegas Golden Knights	Unassigned	T-Mobile Arena	VGK	NHL	\N	\N	\N
37	washington-capitals	Washington Capitals	Unassigned	Capital One Arena	WSH	NHL	\N	\N	\N
38	winnipeg-jets	Winnipeg Jets	Unassigned	Canada Life Centre	WPG	NHL	\N	\N	\N
295	abbotsford-canucks	Abbotsford Canucks	Unassigned	TBD	\N	AHL	35	\N	\N
296	bakersfield-condors	Bakersfield Condors	Unassigned	TBD	\N	AHL	1	\N	\N
297	belleville-senators	Belleville Senators	Unassigned	TBD	\N	AHL	26	\N	\N
298	calgary-wranglers	Calgary Wranglers	Unassigned	TBD	\N	AHL	10	\N	\N
299	charlotte-checkers	Charlotte Checkers	Unassigned	TBD	\N	AHL	18	\N	\N
300	chicago-wolves	Chicago Wolves	Unassigned	TBD	\N	AHL	11	\N	\N
301	cleveland-monsters	Cleveland Monsters	Unassigned	TBD	\N	AHL	14	\N	\N
302	coachella-valley-firebirds	Coachella Valley Firebirds	Unassigned	TBD	\N	AHL	30	\N	\N
303	colorado-eagles	Colorado Eagles	Unassigned	TBD	\N	AHL	13	\N	\N
304	grand-rapids-griffins	Grand Rapids Griffins	Unassigned	TBD	\N	AHL	16	\N	\N
305	hartford-wolf-pack	Hartford Wolf Pack	Unassigned	TBD	\N	AHL	25	\N	\N
306	henderson-silver-knights	Henderson Silver Knights	Unassigned	TBD	\N	AHL	36	\N	\N
307	hershey-bears	Hershey Bears	Unassigned	TBD	\N	AHL	37	\N	\N
308	iowa-wild	Iowa Wild	Unassigned	TBD	\N	AHL	20	\N	\N
309	laval-rocket	Laval Rocket	Unassigned	TBD	\N	AHL	21	\N	\N
310	lehigh-valley-phantoms	Lehigh Valley Phantoms	Unassigned	TBD	\N	AHL	27	\N	\N
311	manitoba-moose	Manitoba Moose	Unassigned	TBD	\N	AHL	38	\N	\N
312	milwaukee-admirals	Milwaukee Admirals	Unassigned	TBD	\N	AHL	22	\N	\N
313	ontario-reign	Ontario Reign	Unassigned	TBD	\N	AHL	19	\N	\N
314	providence-bruins	Providence Bruins	Unassigned	TBD	\N	AHL	3	\N	\N
315	rochester-americans	Rochester Americans	Unassigned	TBD	\N	AHL	9	\N	\N
316	rockford-icehogs	Rockford IceHogs	Unassigned	TBD	\N	AHL	12	\N	\N
317	san-diego-gulls	San Diego Gulls	Unassigned	TBD	\N	AHL	7	\N	\N
318	san-jose-barracuda	San Jose Barracuda	Unassigned	TBD	\N	AHL	29	\N	\N
319	springfield-thunderbirds	Springfield Thunderbirds	Unassigned	TBD	\N	AHL	31	\N	\N
320	syracuse-crunch	Syracuse Crunch	Unassigned	TBD	\N	AHL	32	\N	\N
321	texas-stars	Texas Stars	Unassigned	TBD	\N	AHL	15	\N	\N
322	toronto-marlies	Toronto Marlies	Unassigned	TBD	\N	AHL	2	\N	\N
323	tucson-roadrunners	Tucson Roadrunners	Unassigned	TBD	\N	AHL	34	\N	\N
324	utica-comets	Utica Comets	Unassigned	TBD	\N	AHL	23	\N	\N
325	wilkes-barre-scranton-penguins	Wilkes-Barre Scranton Penguins	Unassigned	TBD	\N	AHL	28	\N	\N
326	hamilton-hammers	Hamilton Hammers	TBD	Hamilton Arena	\N	AHL	\N	\N	\N
329	free-agents	Free Agents	System	Free Agent Pool	UFA	NHL	\N	\N	\N
7	anaheim-ducks	Anaheim Ducks	Unassigned	Honda Center	ANA	NHL	\N	\N	\N
3	boston-bruins	Boston Bruins	Unknown	TD Garden	BOS	NHL	\N	\N	\N
9	buffalo-sabres	Buffalo Sabres	Unassigned	KeyBank Center	BUF	NHL	\N	\N	\N
10	calgary-flames	Calgary Flames	Unassigned	Scotiabank Saddledome	CGY	NHL	\N	\N	\N
11	carolina-hurricanes	Carolina Hurricanes	Unassigned	Lenovo Center	CAR	NHL	\N	\N	\N
12	chicago-blackhawks	Chicago Blackhawks	Unassigned	United Center	CHI	NHL	\N	\N	\N
13	colorado-avalanche	Colorado Avalanche	Unassigned	Ball Arena	COL	NHL	\N	\N	\N
14	columbus-blue-jackets	Columbus Blue Jackets	Unassigned	Nationwide Arena	CBJ	NHL	\N	\N	\N
15	dallas-stars	Dallas Stars	Unassigned	American Airlines Center	DAL	NHL	\N	\N	\N
16	detroit-red-wings	Detroit Red Wings	Unassigned	Little Caesars Arena	DET	NHL	\N	\N	\N
1	edmonton-oilers	Edmonton Oilers	Ladislav Mozolic	Rogers Place	EDM	NHL	\N	\N	\N
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
\.


--
-- Name: Player_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Player_id_seq"', 13359, true);


--
-- Name: Team_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Team_id_seq"', 329, true);


--
-- Name: Player Player_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Player"
    ADD CONSTRAINT "Player_pkey" PRIMARY KEY (id);


--
-- Name: Team Team_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Player_nhlId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Player_nhlId_key" ON public."Player" USING btree ("nhlId");


--
-- Name: Player_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Player_slug_key" ON public."Player" USING btree (slug);


--
-- Name: Team_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Team_code_key" ON public."Team" USING btree (code);


--
-- Name: Team_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Team_slug_key" ON public."Team" USING btree (slug);


--
-- Name: Player Player_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Player"
    ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Team Team_parentTeamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_parentTeamId_fkey" FOREIGN KEY ("parentTeamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict lzn4IEGe6TkjQIefMryyHjZmtBgo5vtOqQVrzMdXgwSmDXB5MA2dP3u8VeHHm05

