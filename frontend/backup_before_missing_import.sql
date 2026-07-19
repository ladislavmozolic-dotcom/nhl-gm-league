--
-- PostgreSQL database dump
--

\restrict djvCD1LnO7jUh3SUqYRwc0pUJxZ00Q5LvLFRCvtGMJFRLjopambgS2NjOGdXAfC

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
    "frozenPoolPlayerSlug" text
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
    "eliteProspectsUrl" text
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

COPY public."Player" (id, slug, name, "position", "teamId", "nhlId", number, "capHit", "contractExpiry", "contractYears", "birthDate", "birthPlace", height, "photoUrl", shoots, weight, positions, nationality, "frozenPoolUrl", "frozenPoolId", "frozenPoolPlayerSlug") FROM stdin;
22	frederik-andersen	Frederik Andersen	G	1	8475883	30	\N	\N	\N	1989-10-02	Herning, DNK	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475883.png	L	229	\N	DNK	\N	\N	\N
27	kevin-fiala	Kevin Fiala	L	19	8477942	22	\N	\N	\N	1996-07-22	St. Gallen, CHE	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477942.png	L	205	\N	CHE	\N	\N	\N
28	erik-haula	Erik Haula	L	19	8475287	\N	\N	\N	\N	1991-03-23	Pori, FIN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475287.png	L	191	\N	FIN	\N	\N	\N
32	scott-laughton	Scott Laughton	C	19	8476872	21	\N	\N	\N	1994-05-30	Oakville, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476872.png	L	190	\N	CAN	\N	\N	\N
34	artemi-panarin	Artemi Panarin	L	19	8478550	10	\N	\N	\N	1991-10-30	Korkino, RUS	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478550.png	R	176	\N	RUS	\N	\N	\N
38	mats-zuccarello	Mats Zuccarello	C	19	8475692	\N	\N	\N	\N	1987-09-01	Oslo, NOR	5'8"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475692.png	L	181	\N	NOR	\N	\N	\N
39	mikey-anderson	Mikey Anderson	D	19	8479998	44	\N	\N	\N	1999-05-25	Roseville, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479998.png	L	195	\N	USA	\N	\N	\N
44	joel-edmundson	Joel Edmundson	D	19	8476441	6	\N	\N	\N	1993-06-28	Brandon, Manitoba, CAN	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476441.png	L	220	\N	CAN	\N	\N	\N
50	bobby-brink	Bobby Brink	R	20	8481553	10	\N	\N	\N	2001-07-08	Minnetonka, Minnesota, USA	5'8"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481553.png	R	169	\N	USA	\N	\N	\N
53	marcus-foligno	Marcus Foligno	L	20	8475220	17	\N	\N	\N	1991-08-10	Buffalo, New York, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475220.png	L	226	\N	USA	\N	\N	\N
57	kirill-kaprizov	Kirill Kaprizov	L	20	8478864	97	\N	\N	\N	1997-04-26	Novokuznetsk, RUS	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478864.png	L	202	\N	RUS	\N	\N	\N
58	michael-mccarron	Michael McCarron	C	20	8477446	47	\N	\N	\N	1995-03-07	Grosse Pointe, Michigan, USA	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477446.png	R	232	\N	USA	\N	\N	\N
62	danila-yurov	Danila Yurov	R	20	8483525	22	\N	\N	\N	2003-12-22	Chelyabinsk, RUS	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483525.png	L	178	\N	RUS	\N	\N	\N
64	jonas-brodin	Jonas Brodin	D	20	8476463	25	\N	\N	\N	1993-07-12	Karlstad, SWE	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476463.png	L	196	\N	SWE	\N	\N	\N
72	david-spacek	David Spacek	D	308	8483766	82	\N	\N	\N	2003-02-18	Columbus, Ohio, USA	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8483766.png	R	174	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9853	9853	jamie-drysdale
99	david-reinbacher	David Reinbacher	D	309	8484220	64	\N	\N	\N	2004-10-25	Hohenems, AUT	6'3	https://assets.nhle.com/mugs/nhl/latest/168x168/8484220.png	R	207	\N	AUT	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10036	10036	jamie-drysdale
74	filip-gustavsson	Filip Gustavsson	G	20	8479406	32	\N	\N	\N	1998-06-07	Skelleftea, SWE	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479406.png	L	184	\N	SWE	\N	\N	\N
78	chase-wutzke	Chase Wutzke	G	20	8485037	95	\N	\N	\N	2006-07-26	Debden, Saskatchewan, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8485037.png	L	158	\N	CAN	\N	\N	\N
83	kirby-dach	Kirby Dach	C	21	8481523	77	\N	\N	\N	2001-01-21	Fort Saskatchewan, Alberta, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481523.png	R	221	\N	CAN	\N	\N	\N
86	jake-evans	Jake Evans	C	21	8478133	71	\N	\N	\N	1996-06-02	Toronto, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478133.png	R	190	\N	CAN	\N	\N	\N
12	vasily-podkolzin	Vasily Podkolzin	R	1	8481617	92	\N	\N	\N	2001-06-24	Moscow, RUS	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481617.png	L	190	\N	RUS	\N	\N	\N
89	juraj-slafkovsk	Juraj Slafkovský	L	21	8483515	20	\N	\N	\N	2004-03-30	Kosice, SVK	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483515.png	L	225	\N	SVK	\N	\N	\N
96	kaiden-guhle	Kaiden Guhle	D	21	8482087	21	\N	\N	\N	2002-01-18	Edmonton, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482087.png	L	202	\N	CAN	\N	\N	\N
100	jayden-struble	Jayden Struble	D	21	8481593	47	\N	\N	\N	2001-09-08	Cumberland, Rhode Island, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481593.png	L	207	\N	USA	\N	\N	\N
103	jakub-dobes	Jakub Dobes	G	21	8482487	75	\N	\N	\N	2001-05-27	Ostrava, CZE	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482487.png	L	215	\N	CZE	\N	\N	\N
106	mavrik-bourque	Mavrik Bourque	C	22	8482145	\N	\N	\N	\N	2002-01-08	Plessisville, Quebec, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482145.png	R	187	\N	CAN	\N	\N	\N
108	jack-drury	Jack Drury	C	22	8480835	\N	\N	\N	\N	2000-02-03	New York, New York, USA	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480835.png	L	186	\N	USA	\N	\N	\N
10623	calle-odelius	Calle Odelius	D	326	\N	\N	\N	\N	\N	2004-05-30	\N	5'11	\N	L	205	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9953	9953	jamie-drysdale
113	nils-hoglander	Nils Hoglander	L	22	8481535	\N	\N	\N	\N	2000-12-20	Bockträsk, SWE	5'9"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481535.png	L	185	\N	SWE	\N	\N	\N
117	steven-stamkos	Steven Stamkos	C	22	8474564	91	\N	\N	\N	1990-02-07	Markham, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8474564.png	R	193	\N	CAN	\N	\N	\N
5	trent-frederic	Trent Frederic	C	1	8479365	10	\N	\N	\N	1998-02-11	St. Louis, Missouri, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479365.png	L	221	\N	USA	\N	\N	\N
7	mattias-janmark	Mattias Janmark	C	1	8477406	13	\N	\N	\N	1992-12-08	Danderyd, SWE	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477406.png	L	205	\N	SWE	\N	\N	\N
16	mattias-ekholm	Mattias Ekholm	D	1	8475218	14	\N	\N	\N	1990-05-24	Borlange, SWE	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475218.png	L	225	\N	SWE	\N	\N	\N
17	ty-emberson	Ty Emberson	D	1	8480834	49	\N	\N	\N	2000-05-23	Eau Claire, Wisconsin, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480834.png	R	193	\N	USA	\N	\N	\N
21	jake-walman	Jake Walman	D	1	8478013	96	\N	\N	\N	1996-02-20	Toronto, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478013.png	L	218	\N	CAN	\N	\N	\N
138	timo-meier	Timo Meier	R	23	8478414	28	\N	\N	\N	1996-10-08	Herisau, CHE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478414.png	L	220	\N	CHE	\N	\N	\N
228	denver-barkey	Denver Barkey	F	310	8484142	52	\N	\N	\N	2005-04-27	Newmarket, Ontario, CAN	5'10	https://assets.nhle.com/mugs/nhl/latest/168x168/8484142.png	L	171	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10720	10720	jamie-drysdale
142	declan-chisholm	Declan Chisholm	D	23	8480990	\N	\N	\N	\N	2000-01-12	Bowmanville, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480990.png	L	205	\N	CAN	\N	\N	\N
144	dougie-hamilton	Dougie Hamilton	D	23	8476462	7	\N	\N	\N	1993-06-17	Toronto, Ontario, CAN	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476462.png	R	230	\N	CAN	\N	\N	\N
148	jonas-siegenthaler	Jonas Siegenthaler	D	23	8478399	71	\N	\N	\N	1997-05-06	Zurich, CHE	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478399.png	L	218	\N	CHE	\N	\N	\N
150	david-rittich	David Rittich	G	23	8479496	\N	\N	\N	\N	1992-08-19	Jihlava, CZE	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479496.png	L	200	\N	CZE	\N	\N	\N
154	emil-heineman	Emil Heineman	L	24	8482476	51	\N	\N	\N	2001-11-16	Leksand, SWE	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482476.png	L	204	\N	SWE	\N	\N	\N
156	bo-horvat	Bo Horvat	C	24	8477500	14	\N	\N	\N	1995-04-05	London, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477500.png	L	225	\N	CAN	\N	\N	\N
160	ondrej-palat	Ondrej Palat	L	24	8476292	81	\N	\N	\N	1991-03-28	Frydek-Mistek, CZE	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476292.png	L	194	\N	CZE	\N	\N	\N
161	kyle-palmieri	Kyle Palmieri	C	24	8475151	21	\N	\N	\N	1991-02-01	Smithtown, New York, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475151.png	R	192	\N	USA	\N	\N	\N
166	adam-pelech	Adam Pelech	D	24	8476917	3	\N	\N	\N	1994-08-16	Toronto, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476917.png	L	212	\N	CAN	\N	\N	\N
167	ryan-pulock	Ryan Pulock	D	24	8477506	6	\N	\N	\N	1994-10-06	Dauphin, Manitoba, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477506.png	R	219	\N	CAN	\N	\N	\N
172	semyon-varlamov	Semyon Varlamov	G	24	8473575	40	\N	\N	\N	1988-04-27	Samara, RUS	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8473575.png	L	201	\N	RUS	\N	\N	\N
173	oliver-bjorkstrand	Oliver Bjorkstrand	R	25	8477416	28	\N	\N	\N	1995-04-10	Herning, DNK	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477416.png	R	175	\N	DNK	\N	\N	\N
177	tye-kartye	Tye Kartye	L	25	8481789	24	\N	\N	\N	2001-04-30	Kingston, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481789.png	L	202	\N	CAN	\N	\N	\N
180	jt-miller	J.T. Miller	C	25	8476468	10	\N	\N	\N	1993-03-14	East Palestine, Ohio, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476468.png	L	211	\N	USA	\N	\N	\N
183	matt-rempe	Matt Rempe	C	25	8482460	73	\N	\N	\N	2002-06-29	Calgary, Alberta, CAN	6'9"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482460.png	R	261	\N	CAN	\N	\N	\N
185	joe-veleno	Joe Veleno	C	25	8480813	90	\N	\N	\N	2000-01-13	Montréal, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480813.png	L	201	\N	CAN	\N	\N	\N
189	adam-fox	Adam Fox	D	25	8479323	23	\N	\N	\N	1998-02-17	Jericho, New York, USA	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479323.png	R	185	\N	USA	\N	\N	\N
192	marcus-pettersson	Marcus Pettersson	D	25	8477969	26	\N	\N	\N	1996-05-08	Skelleftea, SWE	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477969.png	L	174	\N	SWE	\N	\N	\N
195	urho-vaakanainen	Urho Vaakanainen	D	25	8480001	18	\N	\N	\N	1999-01-01	Joensuu, FIN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480001.png	L	202	\N	FIN	\N	\N	\N
197	joonas-korpisalo	Joonas Korpisalo	G	25	8476914	70	\N	\N	\N	1994-04-28	Pori, FIN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476914.png	L	200	\N	FIN	\N	\N	\N
202	andre-burakovsky	Andre Burakovsky	L	26	8477444	\N	\N	\N	\N	1995-02-09	Klagenfurt, AUT	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477444.png	L	203	\N	AUT	\N	\N	\N
203	nick-cousins	Nick Cousins	C	26	8476393	21	\N	\N	\N	1993-07-20	Belleville, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476393.png	L	191	\N	CAN	\N	\N	\N
208	ridly-greig	Ridly Greig	C	26	8482092	71	\N	\N	\N	2002-08-08	Lethbridge, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482092.png	L	184	\N	CAN	\N	\N	\N
211	kurtis-macdermid	Kurtis MacDermid	L	26	8477073	23	\N	\N	\N	1994-03-25	Quebec City, Quebec, CAN	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477073.png	L	233	\N	CAN	\N	\N	\N
214	tim-sttzle	Tim Stützle	C	26	8482116	18	\N	\N	\N	2002-01-15	Viersen, DEU	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482116.png	L	187	\N	DEU	\N	\N	\N
216	thomas-chabot	Thomas Chabot	D	26	8478469	72	\N	\N	\N	1997-01-30	Sainte-Marie, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478469.png	L	200	\N	CAN	\N	\N	\N
220	jake-sanderson	Jake Sanderson	D	26	8482105	85	\N	\N	\N	2002-07-08	Whitefish, Montana, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482105.png	L	202	\N	USA	\N	\N	\N
223	artem-zub	Artem Zub	D	26	8482245	2	\N	\N	\N	1995-10-03	Khabarovsk, RUS	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482245.png	R	201	\N	RUS	\N	\N	\N
226	linus-ullmark	Linus Ullmark	G	26	8476999	35	\N	\N	\N	1993-07-31	Lugnvik, SWE	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476999.png	L	223	\N	SWE	\N	\N	\N
227	noel-acciari	Noel Acciari	C	27	8478569	\N	\N	\N	\N	1991-12-01	Johnston, Rhode Island, USA	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478569.png	R	204	\N	USA	\N	\N	\N
232	christian-dvorak	Christian Dvorak	C	27	8477989	22	\N	\N	\N	1996-02-02	Palos, Illinois, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477989.png	L	190	\N	USA	\N	\N	\N
121	nicolas-hague	Nicolas Hague	D	22	8479980	41	\N	\N	\N	1998-12-05	Kitchener, Ontario, CAN	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479980.png	L	245	\N	CAN	\N	\N	\N
126	adam-wilsby	Adam Wilsby	D	22	8482482	83	\N	\N	\N	2000-08-07	Stockholm, SWE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482482.png	L	188	\N	SWE	\N	\N	\N
130	jesper-boqvist	Jesper Boqvist	C	23	8480003	70	\N	\N	\N	1998-10-30	Falun, SWE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480003.png	L	191	\N	SWE	\N	\N	\N
131	jesper-bratt	Jesper Bratt	L	23	8479407	63	\N	\N	\N	1998-07-30	Stockholm, SWE	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479407.png	L	175	\N	SWE	\N	\N	\N
259	sidney-crosby	Sidney Crosby	C	28	8471675	87	\N	\N	\N	1987-08-07	Cole Harbour, Nova Scotia, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8471675.png	L	200	\N	CAN	\N	\N	\N
261	ben-kindel	Ben Kindel	C	28	8485414	81	\N	\N	\N	2007-04-19	Coquitlam, British Columbia, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8485414.png	R	182	\N	CAN	\N	\N	\N
265	evgeni-malkin	Evgeni Malkin	C	28	8471215	71	\N	\N	\N	1986-07-31	Magnitogorsk, RUS	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8471215.png	L	213	\N	RUS	\N	\N	\N
267	rickard-rakell	Rickard Rakell	R	28	8476483	67	\N	\N	\N	1993-05-05	Sundbyberg, SWE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476483.png	R	194	\N	SWE	\N	\N	\N
276	kris-letang	Kris Letang	D	28	8471724	58	\N	\N	\N	1987-04-24	Montréal, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8471724.png	R	199	\N	CAN	\N	\N	\N
279	arturs-silovs	Arturs Silovs	G	28	8481668	37	\N	\N	\N	2001-03-22	Riga, LVA	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481668.png	L	208	\N	LVA	\N	\N	\N
9874	matt-luff	Matt Luff	R	326	\N	\N	\N	\N	\N	1997-05-05	\N	6'3	\N	R	219	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6733	6733	jamie-drysdale
245	jamie-drysdale	Jamie Drysdale	D	27	8482142	9	\N	\N	\N	2002-04-08	Toronto, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482142.png	R	185	\N	CAN	\N	\N	\N
282	adam-gaudette	Adam Gaudette	R	29	8478874	81	\N	\N	\N	1996-10-03	Braintree, Massachusetts, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478874.png	R	190	\N	USA	\N	\N	\N
284	collin-graf	Collin Graf	R	29	8484911	51	\N	\N	\N	2002-09-21	Lincoln, Massachusetts, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484911.png	R	190	\N	USA	\N	\N	\N
288	kiefer-sherwood	Kiefer Sherwood	L	29	8480748	44	\N	\N	\N	1995-03-31	Columbus, Ohio, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480748.png	R	194	\N	USA	\N	\N	\N
293	michael-kesselring	Michael Kesselring	D	29	8480891	7	\N	\N	\N	2000-01-13	Florence, South Carolina, USA	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480891.png	R	215	\N	USA	\N	\N	\N
295	dmitry-orlov	Dmitry Orlov	D	29	8475200	9	\N	\N	\N	1991-07-23	Novokuznetsk, RUS	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475200.png	L	215	\N	RUS	\N	\N	\N
298	eric-comrie	Eric Comrie	G	29	8477480	1	\N	\N	\N	1995-07-06	Edmonton, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477480.png	L	190	\N	CAN	\N	\N	\N
301	berkly-catton	Berkly Catton	C	30	8484800	27	\N	\N	\N	2006-01-14	Saskatoon, Saskatchewan, CAN	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484800.png	L	179	\N	CAN	\N	\N	\N
304	kaapo-kakko	Kaapo Kakko	R	30	8481554	84	\N	\N	\N	2001-02-13	Turku, FIN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481554.png	L	215	\N	FIN	\N	\N	\N
80	owen-beck	Owen Beck	F	309	8483424	62	\N	\N	\N	2004-02-03	Port Hope, Ontario, CAN	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8483424.png	R	199	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10367	10367	jamie-drysdale
310	ryan-winterton	Ryan Winterton	C	30	8482751	26	\N	\N	\N	2003-09-04	Markham, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482751.png	R	175	\N	CAN	\N	\N	\N
312	vince-dunn	Vince Dunn	D	30	8478407	29	\N	\N	\N	1996-10-29	Mississauga, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478407.png	L	200	\N	CAN	\N	\N	\N
315	adam-larsson	Adam Larsson	D	30	8476457	6	\N	\N	\N	1992-11-12	Skelleftea, SWE	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476457.png	R	207	\N	SWE	\N	\N	\N
319	joey-daccord	Joey Daccord	G	30	8478916	35	\N	\N	\N	1996-08-19	Boston, Massachusetts, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478916.png	L	201	\N	USA	\N	\N	\N
321	jonatan-berggren	Jonatan Berggren	R	31	8481013	29	\N	\N	\N	2000-07-16	Uppsala, SWE	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481013.png	L	195	\N	SWE	\N	\N	\N
327	connor-mcmichael	Connor McMichael	L	31	8481580	\N	\N	\N	\N	2001-01-15	Ajax, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481580.png	L	180	\N	CAN	\N	\N	\N
330	jimmy-snuggerud	Jimmy Snuggerud	R	31	8483516	21	\N	\N	\N	2004-06-01	Minneapolis, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483516.png	R	193	\N	USA	\N	\N	\N
332	pius-suter	Pius Suter	C	31	8480459	22	\N	\N	\N	1996-05-24	Zurich, CHE	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480459.png	L	172	\N	CHE	\N	\N	\N
336	philip-broberg	Philip Broberg	D	31	8481598	6	\N	\N	\N	2001-06-25	Orebro, SWE	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481598.png	L	210	\N	SWE	\N	\N	\N
338	cam-fowler	Cam Fowler	D	31	8475764	17	\N	\N	\N	1991-12-05	Windsor, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475764.png	L	213	\N	CAN	\N	\N	\N
342	jordan-binnington	Jordan Binnington	G	31	8476412	50	\N	\N	\N	1993-07-11	Richmond Hill, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476412.png	L	172	\N	CAN	\N	\N	\N
347	gage-goncalves	Gage Goncalves	C	32	8482201	93	\N	\N	\N	2001-01-16	Mission, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482201.png	L	189	\N	CAN	\N	\N	\N
349	jake-guentzel	Jake Guentzel	C	32	8477404	59	\N	\N	\N	1994-10-06	Omaha, Nebraska, USA	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477404.png	L	176	\N	USA	\N	\N	\N
237	travis-konecny	Travis Konecny	R	27	8478439	11	\N	\N	\N	1997-03-11	London, Ontario, CAN	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478439.png	R	192	\N	CAN	\N	\N	\N
402	clayton-keller	Clayton Keller	R	34	8479343	9	\N	\N	\N	1998-07-29	Chesterfield, Missouri, USA	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479343.png	L	175	\N	USA	\N	\N	\N
249	rasmus-ristolainen	Rasmus Ristolainen	D	27	8477499	55	\N	\N	\N	1994-10-27	Turku, FIN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477499.png	R	208	\N	FIN	\N	\N	\N
252	cam-york	Cam York	D	27	8481546	8	\N	\N	\N	2001-01-05	Anaheim, California, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481546.png	L	194	\N	USA	\N	\N	\N
255	dan-vladar	Dan Vladar	G	27	8478435	80	\N	\N	\N	1997-08-20	Prague, CZE	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478435.png	L	209	\N	CZE	\N	\N	\N
415	andrew-peeke	Andrew Peeke	D	34	8479369	\N	\N	\N	\N	1998-03-17	Parkland, Florida, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479369.png	R	214	\N	USA	\N	\N	\N
419	mackenzie-weegar	MacKenzie Weegar	D	34	8477346	52	\N	\N	\N	1994-01-07	Ottawa, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477346.png	R	206	\N	CAN	\N	\N	\N
421	karel-vejmelka	Karel Vejmelka	G	34	8478872	70	\N	\N	\N	1996-05-25	Trebic, CZE	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478872.png	R	221	\N	CZE	\N	\N	\N
425	jake-debrusk	Jake DeBrusk	L	35	8478498	74	\N	\N	\N	1996-10-17	Edmonton, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478498.png	L	198	\N	CAN	\N	\N	\N
427	linus-karlsson	Linus Karlsson	C	35	8481024	94	\N	\N	\N	1999-11-16	Landsbro, SWE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481024.png	R	178	\N	SWE	\N	\N	\N
435	filip-hronek	Filip Hronek	D	35	8479425	17	\N	\N	\N	1997-11-02	Hradec Kralove, CZE	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479425.png	R	190	\N	CZE	\N	\N	\N
442	kevin-lankinen	Kevin Lankinen	G	35	8480947	32	\N	\N	\N	1995-04-28	Helsinki, FIN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480947.png	L	190	\N	FIN	\N	\N	\N
452	brett-howden	Brett Howden	C	36	8479353	21	\N	\N	\N	1998-03-29	Oakbank, Manitoba, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479353.png	L	201	\N	CAN	\N	\N	\N
445	braeden-bowman	Braeden Bowman	F	306	8483890	42	\N	\N	\N	2003-06-26	Kitchener, Ontario, CAN	6'1	https://assets.nhle.com/mugs/nhl/latest/168x168/8483890.png	R	205	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9250	9250	jamie-drysdale
458	jonas-rondbjerg	Jonas Rondbjerg	R	36	8480007	46	\N	\N	\N	1999-03-31	Horsholm, DNK	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480007.png	L	206	\N	DNK	\N	\N	\N
464	noah-hanifin	Noah Hanifin	D	36	8478396	15	\N	\N	\N	1997-01-25	Boston, Massachusetts, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478396.png	L	206	\N	USA	\N	\N	\N
5716	brandon-hawkins	Brandon Hawkins	R	304	\N	\N	\N	\N	\N	1994-04-25	\N	5.10	\N	R	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7617	7617	jamie-drysdale
5144	brett-berard	Brett Berard	F	305	\N	\N	\N	\N	\N	2002-09-09	\N	5'9	\N	L	175	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9642	9642	jamie-drysdale
403	anders-lee	Anders Lee	C	34	8475314	\N	\N	\N	\N	1990-07-03	Edina, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475314.png	L	234	\N	USA	\N	\N	\N
466	jeremy-lauzon	Jeremy Lauzon	D	36	8478468	5	\N	\N	\N	1997-04-28	Val-d'Or, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478468.png	L	225	\N	CAN	\N	\N	\N
351	jansen-harkins	Jansen Harkins	C	32	8478424	\N	\N	\N	\N	1997-05-23	Cleveland, Ohio, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478424.png	L	197	\N	USA	\N	\N	\N
354	nikita-kucherov	Nikita Kucherov	R	32	8476453	86	\N	\N	\N	1993-06-17	Maykop, RUS	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476453.png	L	173	\N	RUS	\N	\N	\N
358	jeffrey-viel	Jeffrey Viel	L	32	8479705	25	\N	\N	\N	1997-01-28	Rimouski, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479705.png	L	214	\N	CAN	\N	\N	\N
361	max-crozier	Max Crozier	D	32	8481719	24	\N	\N	\N	2000-04-19	Calgary, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481719.png	R	204	\N	CAN	\N	\N	\N
364	emil-lilleberg	Emil Lilleberg	D	32	8482929	78	\N	\N	\N	2001-02-02	Sarpsborg, NOR	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482929.png	L	215	\N	NOR	\N	\N	\N
366	jj-moser	J.J. Moser	D	32	8482655	90	\N	\N	\N	2000-06-06	Biel, CHE	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482655.png	L	183	\N	CHE	\N	\N	\N
369	andrei-vasilevskiy	Andrei Vasilevskiy	G	32	8476883	88	\N	\N	\N	1994-07-25	Tyumen, RUS	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476883.png	L	223	\N	RUS	\N	\N	\N
370	teddy-blueger	Teddy Blueger	C	2	8476927	\N	\N	\N	\N	1994-08-15	Riga, LVA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476927.png	L	185	\N	LVA	\N	\N	\N
375	dakota-joshua	Dakota Joshua	C	2	8478057	81	\N	\N	\N	1996-05-15	Dearborn, Michigan, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478057.png	L	218	\N	USA	\N	\N	\N
378	zack-macewen	Zack MacEwen	C	2	8479772	\N	\N	\N	\N	1996-07-08	Charlottetown, Prince Edward Island, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479772.png	R	226	\N	CAN	\N	\N	\N
381	nick-paul	Nick Paul	L	2	8477426	\N	\N	\N	\N	1995-03-20	Mississauga, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477426.png	L	234	\N	CAN	\N	\N	\N
387	jake-mccabe	Jake McCabe	D	2	8476931	22	\N	\N	\N	1993-10-12	Eau Claire, Wisconsin, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476931.png	L	210	\N	USA	\N	\N	\N
391	troy-stecher	Troy Stecher	D	2	8479442	28	\N	\N	\N	1994-04-07	Richmond, British Columbia, CAN	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479442.png	R	184	\N	CAN	\N	\N	\N
393	sergei-bobrovsky	Sergei Bobrovsky	G	2	8475683	\N	\N	\N	\N	1988-09-20	Novokuznetsk, RUS	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475683.png	L	180	\N	RUS	\N	\N	\N
398	lawson-crouse	Lawson Crouse	L	34	8478474	67	\N	\N	\N	1997-06-23	Mt. Brydges, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478474.png	L	214	\N	CAN	\N	\N	\N
441	thatcher-demko	Thatcher Demko	G	35	8477967	35	\N	\N	\N	1995-12-08	San Diego, California, USA	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477967.png	L	192	\N	USA	\N	\N	\N
431	aatu-rty	Aatu Räty	C	35	8482691	54	\N	\N	\N	2002-11-14	Oulu, FIN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482691.png	L	204	\N	FIN	\N	\N	\N
399	dylan-guenther	Dylan Guenther	R	34	8482699	11	\N	\N	\N	2003-04-10	Edmonton, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482699.png	R	191	\N	CAN	\N	\N	\N
407	nick-schmaltz	Nick Schmaltz	C	34	8477951	8	\N	\N	\N	1996-02-23	Madison, Wisconsin, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477951.png	R	184	\N	USA	\N	\N	\N
410	vincent-trocheck	Vincent Trocheck	C	34	8476389	\N	\N	\N	\N	1993-07-11	Pittsburgh, Pennsylvania, USA	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476389.png	R	187	\N	USA	\N	\N	\N
414	john-marino	John Marino	D	34	8478507	6	\N	\N	\N	1997-05-21	North Easton, Massachusetts, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478507.png	R	200	\N	USA	\N	\N	\N
488	jakob-chychrun	Jakob Chychrun	D	37	8479345	6	\N	\N	\N	1998-03-31	Boca Raton, Florida, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479345.png	L	215	\N	USA	\N	\N	\N
490	martin-fehrvry	Martin Fehérváry	D	37	8480796	42	\N	\N	\N	1999-10-06	Bratislava, SVK	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480796.png	L	215	\N	SVK	\N	\N	\N
494	matt-roy	Matt Roy	D	37	8478911	3	\N	\N	\N	1995-03-01	Detroit, Michigan, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478911.png	R	220	\N	USA	\N	\N	\N
496	charlie-lindgren	Charlie Lindgren	G	37	8479292	79	\N	\N	\N	1993-12-18	Lakeville, Minnesota, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479292.png	R	190	\N	USA	\N	\N	\N
501	kyle-connor	Kyle Connor	L	38	8478398	81	\N	\N	\N	1996-12-09	Shelby Township, Michigan, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478398.png	L	183	\N	USA	\N	\N	\N
502	alex-iafallo	Alex Iafallo	L	38	8480113	9	\N	\N	\N	1993-12-21	Eden, New York, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480113.png	L	201	\N	USA	\N	\N	\N
507	cole-perfetti	Cole Perfetti	C	38	8482149	91	\N	\N	\N	2002-01-01	Whitby, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482149.png	L	185	\N	CAN	\N	\N	\N
509	mark-scheifele	Mark Scheifele	C	38	8476460	55	\N	\N	\N	1993-03-15	Kitchener, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476460.png	R	207	\N	CAN	\N	\N	\N
513	haydn-fleury	Haydn Fleury	D	38	8477938	24	\N	\N	\N	1996-07-08	Carlyle, Saskatchewan, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477938.png	L	207	\N	CAN	\N	\N	\N
515	neal-pionk	Neal Pionk	D	38	8480145	4	\N	\N	\N	1995-07-29	Omaha, Nebraska, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480145.png	R	190	\N	USA	\N	\N	\N
519	stuart-skinner	Stuart Skinner	G	38	8479973	74	\N	\N	\N	1998-11-01	Edmonton, Alberta, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479973.png	L	215	\N	CAN	\N	\N	\N
500	nikita-chibrikov	Nikita Chibrikov	L	311	8482787	90	\N	\N	\N	2003-02-16	Moscow, RUS	5'10	https://assets.nhle.com/mugs/nhl/latest/168x168/8482787.png	L	170	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9759	9759	jamie-drysdale
552	james-hagens	James Hagens	F	314	8485395	44	\N	\N	\N	2006-11-03	Hauppauge, New York, USA	5'11	https://assets.nhle.com/mugs/nhl/latest/168x168/8485395.png	L	177	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11000	11000	jamie-drysdale
546	jett-woo	Jett Woo	D	318	8480808	\N	\N	\N	\N	2000-07-27	Winnipeg, Manitoba, CAN	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8480808.png	R	205	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7597	7597	jamie-drysdale
531	ryan-poehling	Ryan Poehling	C	7	8480068	25	\N	\N	\N	1999-01-03	Lakeville, Minnesota, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480068.png	L	206	\N	USA	\N	\N	\N
539	nick-jensen	Nick Jensen	D	7	8475324	\N	\N	\N	\N	1990-09-21	Rogers, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475324.png	R	202	\N	USA	\N	\N	\N
562	alex-steeves	Alex Steeves	C	314	8482634	21	\N	\N	\N	1999-12-10	Saint Paul, Minnesota, USA	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8482634.png	L	199	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8883	8883	jamie-drysdale
508	isak-rosen	Isak Rosen	R	315	8482765	27	\N	\N	\N	2003-03-15	Solna, SWE	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8482765.png	L	185	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9504	9504	jamie-drysdale
548	lukas-dostal	Lukas Dostal	G	7	8480843	1	\N	\N	\N	2000-06-22	Brno, CZE	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480843.png	L	190	\N	CZE	\N	\N	\N
551	morgan-geekie	Morgan Geekie	C	3	8479987	39	\N	\N	\N	1998-07-20	Strathclair, Manitoba, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479987.png	R	212	\N	CAN	\N	\N	\N
554	mark-kastelic	Mark Kastelic	C	3	8480355	47	\N	\N	\N	1999-03-11	Phoenix, Arizona, USA	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480355.png	R	234	\N	USA	\N	\N	\N
557	elias-lindholm	Elias Lindholm	C	3	8477496	28	\N	\N	\N	1994-12-02	Boden, SWE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477496.png	R	200	\N	SWE	\N	\N	\N
560	david-pastrnak	David Pastrnak	R	3	8477956	88	\N	\N	\N	1996-05-25	Havirov, CZE	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477956.png	R	199	\N	CZE	\N	\N	\N
566	connor-clifton	Connor Clifton	D	3	8477365	75	\N	\N	\N	1995-04-28	Matawan, New Jersey, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477365.png	R	196	\N	USA	\N	\N	\N
568	henri-jokiharju	Henri Jokiharju	D	3	8480035	20	\N	\N	\N	1999-06-17	Oulu, FIN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480035.png	R	205	\N	FIN	\N	\N	\N
572	nikita-zadorov	Nikita Zadorov	D	3	8477507	91	\N	\N	\N	1995-04-16	Moscow, RUS	6'7"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477507.png	L	255	\N	RUS	\N	\N	\N
574	zach-benson	Zach Benson	L	9	8484145	6	\N	\N	\N	2005-05-12	Chilliwack, British Columbia, CAN	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484145.png	L	177	\N	CAN	\N	\N	\N
581	peyton-krebs	Peyton Krebs	C	9	8481522	19	\N	\N	\N	2001-01-26	Calgary, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481522.png	L	188	\N	CAN	\N	\N	\N
582	jiri-kulich	Jiri Kulich	C	9	8483468	20	\N	\N	\N	2004-04-14	Kadan, CZE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483468.png	L	193	\N	CZE	\N	\N	\N
523	cutter-gauthier	Cutter Gauthier	L	7	8483445	61	\N	\N	\N	2004-01-19	Skelleftea, SWE	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483445.png	L	205	\N	SWE	\N	\N	\N
416	nate-schmidt	Nate Schmidt	D	34	8477220	88	\N	\N	\N	1991-07-16	St. Cloud, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477220.png	L	197	\N	USA	\N	\N	\N
478	jordan-kyrou	Jordan Kyrou	R	37	8479385	25	\N	\N	\N	1998-05-05	Toronto, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479385.png	R	189	\N	CAN	\N	\N	\N
482	aliaksei-protas	Aliaksei Protas	L	37	8481656	21	\N	\N	\N	2001-01-06	Vitebsk, BLR	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481656.png	L	250	\N	BLR	\N	\N	\N
484	justin-sourdif	Justin Sourdif	C	37	8482088	34	\N	\N	\N	2002-03-24	Richmond, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482088.png	R	195	\N	CAN	\N	\N	\N
608	joel-farabee	Joel Farabee	L	10	8480797	86	\N	\N	\N	2000-02-25	Syracuse, New York, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480797.png	L	186	\N	USA	\N	\N	\N
5147	jason-polin	Jason Polin	F	303	\N	\N	\N	\N	\N	1999-06-17	\N	6'0	\N	R	198	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9677	9677	jamie-drysdale
596	zach-metsa	Zach Metsa	D	315	8484305	73	\N	\N	\N	1998-10-19	Delafield, Wisconsin, USA	5'9	https://assets.nhle.com/mugs/nhl/latest/168x168/8484305.png	R	198	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9743	9743	jamie-drysdale
614	ben-jones	Ben Jones	C	308	8480259	64	\N	\N	\N	1999-02-26	Waterloo, Ontario, CAN	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8480259.png	L	187	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7653	7653	jamie-drysdale
616	adam-klapka	Adam Klapka	R	10	8483609	43	\N	\N	\N	2000-09-14	Praha, CZE	6'8"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483609.png	R	235	\N	CZE	\N	\N	\N
664	nick-lardis	Nick Lardis	F	316	8484185	76	\N	\N	\N	2005-07-08	Oakville, Ontario, CAN	5'11	https://assets.nhle.com/mugs/nhl/latest/168x168/8484185.png	L	165	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10138	10138	jamie-drysdale
622	connor-zary	Connor Zary	C	10	8482074	47	\N	\N	\N	2001-09-25	Saskatoon, Saskatchewan, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482074.png	L	178	\N	CAN	\N	\N	\N
671	dominic-toninato	Dominic Toninato	C	316	8476952	25	\N	\N	\N	1994-03-09	Duluth, Minnesota, USA	6'2	https://assets.nhle.com/mugs/nhl/latest/168x168/8476952.png	L	201	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6813	6813	jamie-drysdale
628	simon-nemec	Simon Nemec	D	10	8483495	71	\N	\N	\N	2004-02-15	Liptovský Mikuláš, SVK	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483495.png	R	190	\N	SVK	\N	\N	\N
633	devin-cooley	Devin Cooley	G	10	8482445	1	\N	\N	\N	1997-05-25	Los Gatos, California, USA	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482445.png	L	192	\N	USA	\N	\N	\N
634	dustin-wolf	Dustin Wolf	G	10	8481692	32	\N	\N	\N	2001-04-16	Gilroy, California, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481692.png	L	166	\N	USA	\N	\N	\N
639	nikolaj-ehlers	Nikolaj Ehlers	L	11	8477940	27	\N	\N	\N	1996-02-14	Aalborg, DNK	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477940.png	L	168	\N	DNK	\N	\N	\N
640	taylor-hall	Taylor Hall	L	11	8475791	71	\N	\N	\N	1991-11-14	Calgary, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475791.png	L	210	\N	CAN	\N	\N	\N
644	jordan-martinook	Jordan Martinook	L	11	8476921	48	\N	\N	\N	1992-07-25	Brandon, Manitoba, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476921.png	L	208	\N	CAN	\N	\N	\N
645	eric-robinson	Eric Robinson	L	11	8480762	50	\N	\N	\N	1995-06-14	Bellmawr, New Jersey, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480762.png	L	220	\N	USA	\N	\N	\N
651	kandre-miller	K'Andre Miller	D	11	8480817	19	\N	\N	\N	2000-01-21	St. Paul, Minnesota, USA	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480817.png	L	210	\N	USA	\N	\N	\N
653	jaccob-slavin	Jaccob Slavin	D	11	8476958	74	\N	\N	\N	1994-05-01	Denver, Colorado, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476958.png	L	207	\N	USA	\N	\N	\N
657	connor-bedard	Connor Bedard	C	12	8484144	98	\N	\N	\N	2005-07-17	North Vancouver, British Columbia, CAN	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484144.png	R	190	\N	CAN	\N	\N	\N
659	sacha-boisvert	Sacha Boisvert	C	12	8484793	12	\N	\N	\N	2006-03-17	Trois-Rivières, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484793.png	L	176	\N	CAN	\N	\N	\N
670	teuvo-teravainen	Teuvo Teravainen	C	12	8476882	86	\N	\N	\N	1994-09-11	Helsinki, FIN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476882.png	L	191	\N	FIN	\N	\N	\N
694	fedor-svechkov	Fedor Svechkov	C	312	8482768	\N	\N	\N	\N	2003-04-05	Togliatti, RUS	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8482768.png	L	187	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9877	9877	jamie-drysdale
673	ian-cole	Ian Cole	D	12	8474013	\N	\N	\N	\N	1989-02-21	Ann Arbor, Michigan, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8474013.png	L	237	\N	USA	\N	\N	\N
677	artyom-levshunov	Artyom Levshunov	D	12	8484783	55	\N	\N	\N	2005-10-28	Zhlobin, BLR	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484783.png	R	208	\N	BLR	\N	\N	\N
680	spencer-knight	Spencer Knight	G	12	8481519	30	\N	\N	\N	2001-04-19	Darien, Connecticut, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481519.png	L	191	\N	USA	\N	\N	\N
683	vinnie-hinostroza	Vinnie Hinostroza	C	13	8476994	\N	\N	\N	\N	1994-04-03	Chicago, Illinois, USA	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476994.png	R	183	\N	USA	\N	\N	\N
687	artturi-lehkonen	Artturi Lehkonen	L	13	8477476	62	\N	\N	\N	1995-07-04	Piikkio, FIN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477476.png	L	179	\N	FIN	\N	\N	\N
689	martin-necas	Martin Necas	C	13	8480039	88	\N	\N	\N	1999-01-15	Nove Mesto na Morave, CZE	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480039.png	R	195	\N	CZE	\N	\N	\N
692	nicolas-roy	Nicolas Roy	C	13	8478462	10	\N	\N	\N	1997-02-05	Amos, Quebec, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478462.png	R	200	\N	CAN	\N	\N	\N
696	noah-juulsen	Noah Juulsen	D	13	8478454	\N	\N	\N	\N	1997-04-02	Surrey, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478454.png	R	201	\N	CAN	\N	\N	\N
700	josh-manson	Josh Manson	D	13	8476312	42	\N	\N	\N	1991-10-07	Hinsdale, Illinois, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476312.png	R	218	\N	USA	\N	\N	\N
607	matt-coronato	Matt Coronato	R	10	8482679	27	\N	\N	\N	2002-11-14	Greenlawn, New York, USA	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482679.png	R	183	\N	USA	\N	\N	\N
598	owen-power	Owen Power	D	9	8482671	25	\N	\N	\N	2002-11-22	Mississauga, Ontario, CAN	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482671.png	L	226	\N	CAN	\N	\N	\N
602	colten-ellis	Colten Ellis	G	9	8481551	92	\N	\N	\N	2000-10-05	Whycocomagh, Nova Scotia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481551.png	L	191	\N	CAN	\N	\N	\N
605	matt-villalta	Matt Villalta	G	9	8480191	\N	\N	\N	\N	1999-06-03	Kingston, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480191.png	L	190	\N	CAN	\N	\N	\N
725	elvis-merzlikins	Elvis Merzlikins	G	14	8478007	90	\N	\N	\N	1994-04-13	Riga, LVA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478007.png	L	190	\N	LVA	\N	\N	\N
727	colin-blackwell	Colin Blackwell	C	15	8476278	15	\N	\N	\N	1993-03-28	North Andover, Massachusetts, USA	5'8"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476278.png	R	181	\N	USA	\N	\N	\N
731	roope-hintz	Roope Hintz	C	15	8478449	24	\N	\N	\N	1996-11-17	Nokia, FIN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478449.png	L	217	\N	FIN	\N	\N	\N
735	joel-kiviranta	Joel Kiviranta	L	15	8481641	25	\N	\N	\N	1996-03-23	Vantaa, FIN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481641.png	L	185	\N	FIN	\N	\N	\N
739	sam-steel	Sam Steel	C	15	8479351	18	\N	\N	\N	1998-02-03	Ardrossan, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479351.png	L	185	\N	CAN	\N	\N	\N
745	nils-lundkvist	Nils Lundkvist	D	15	8480878	5	\N	\N	\N	2000-07-27	Pitea, SWE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480878.png	R	194	\N	SWE	\N	\N	\N
750	viktor-arvidsson	Viktor Arvidsson	L	16	8478042	\N	\N	\N	\N	1993-04-08	Skelleftea, SWE	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478042.png	R	181	\N	SWE	\N	\N	\N
751	jt-compher	J.T. Compher	L	16	8477456	37	\N	\N	\N	1995-04-08	Northbrook, Illinois, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477456.png	R	191	\N	USA	\N	\N	\N
755	marco-kasper	Marco Kasper	C	16	8483464	92	\N	\N	\N	2004-04-08	Innsbruck, AUT	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483464.png	L	202	\N	AUT	\N	\N	\N
758	michael-rasmussen	Michael Rasmussen	C	16	8479992	27	\N	\N	\N	1999-04-17	Surrey, British Columbia, CAN	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479992.png	L	222	\N	CAN	\N	\N	\N
5149	jorian-donovan	Jorian Donovan	D	297	\N	\N	\N	\N	\N	2004-04-05	\N	6'1	\N	L	200	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9719	9719	jamie-drysdale
759	lucas-raymond	Lucas Raymond	L	16	8482078	23	\N	\N	\N	2002-03-28	Gothenburg, SWE	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482078.png	R	186	\N	SWE	\N	\N	\N
764	justin-faulk	Justin Faulk	D	16	8475753	72	\N	\N	\N	1992-03-20	South St. Paul, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475753.png	R	208	\N	USA	\N	\N	\N
765	albert-johansson	Albert Johansson	D	16	8481607	20	\N	\N	\N	2001-01-04	Karlstad, SWE	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481607.png	L	195	\N	SWE	\N	\N	\N
2	colton-dach	Colton Dach	C	1	8482703	34	\N	\N	\N	2003-01-04	St. Albert, Alberta, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482703.png	L	218	\N	CAN	\N	\N	\N
795	sam-bennett	Sam Bennett	C	18	8477935	9	\N	\N	\N	1996-06-20	Holland Landing, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477935.png	L	193	\N	CAN	\N	\N	\N
797	jonah-gadjovich	Jonah Gadjovich	L	18	8479981	12	\N	\N	\N	1998-10-12	Whitby, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479981.png	L	211	\N	CAN	\N	\N	\N
800	anton-lundell	Anton Lundell	C	18	8482113	15	\N	\N	\N	2001-10-03	Espoo, FIN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482113.png	L	196	\N	FIN	\N	\N	\N
803	cole-reinhardt	Cole Reinhardt	L	18	8481133	29	\N	\N	\N	2000-02-01	Calgary, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481133.png	L	207	\N	CAN	\N	\N	\N
805	cole-schwindt	Cole Schwindt	C	18	8481655	79	\N	\N	\N	2001-04-25	Kitchener, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481655.png	R	210	\N	CAN	\N	\N	\N
809	uvis-balinskis	Uvis Balinskis	D	18	8484304	26	\N	\N	\N	1996-08-01	Ventspils, LVA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484304.png	L	196	\N	LVA	\N	\N	\N
812	radko-gudas	Radko Gudas	D	18	8475462	6	\N	\N	\N	1990-06-05	Prague, CZE	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475462.png	R	208	\N	CZE	\N	\N	\N
815	niko-mikkola	Niko Mikkola	D	18	8478859	77	\N	\N	\N	1996-04-27	Kiiminki, FIN	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478859.png	L	204	\N	FIN	\N	\N	\N
819	akira-schmid	Akira Schmid	G	18	8481033	40	\N	\N	\N	2000-05-12	Bern, CHE	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481033.png	L	190	\N	CHE	\N	\N	\N
204	dylan-cozens	Dylan Cozens	C	26	8481528	24	\N	\N	\N	2001-02-09	Whitehorse, Yukon Territory, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481528.png	R	205	\N	CAN	\N	\N	\N
231	sean-couturier	Sean Couturier	C	27	8476461	14	\N	\N	\N	1992-12-07	Phoenix, Arizona, USA	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476461.png	L	210	\N	USA	\N	\N	\N
241	owen-tippett	Owen Tippett	R	27	8480015	74	\N	\N	\N	1999-02-16	Peterborough, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480015.png	R	210	\N	CAN	\N	\N	\N
277	trevor-van-riemsdyk	Trevor van Riemsdyk	D	28	8477845	\N	\N	\N	\N	1991-07-24	Middletown, New Jersey, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477845.png	R	210	\N	USA	\N	\N	\N
285	mason-marchment	Mason Marchment	L	29	8478975	27	\N	\N	\N	1995-06-18	Uxbridge, Ontario, CAN	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478975.png	L	212	\N	CAN	\N	\N	\N
532	beckett-sennecke	Beckett Sennecke	R	7	8484762	45	\N	\N	\N	2006-01-28	Toronto, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484762.png	R	206	\N	CAN	\N	\N	\N
793	aleksander-barkov	Aleksander Barkov	C	18	8477493	16	\N	\N	\N	1995-09-02	Tampere, FIN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477493.png	L	214	\N	FIN	\N	\N	\N
794	john-beecher	John Beecher	C	18	8481556	17	\N	\N	\N	2001-04-05	Elmira, New York, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481556.png	L	220	\N	USA	\N	\N	\N
707	kent-johnson	Kent Johnson	C	14	8482660	91	\N	\N	\N	2002-10-18	Port Moody, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482660.png	L	170	\N	CAN	\N	\N	\N
715	dmitri-voronkov	Dmitri Voronkov	L	14	8481716	10	\N	\N	\N	2000-09-10	Angarsk, RUS	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481716.png	L	234	\N	RUS	\N	\N	\N
716	miles-wood	Miles Wood	L	14	8477425	11	\N	\N	\N	1995-09-13	Buffalo, New York, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477425.png	L	209	\N	USA	\N	\N	\N
721	ivan-provorov	Ivan Provorov	D	14	8478500	9	\N	\N	\N	1997-01-13	Yaroslavl, RUS	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478500.png	L	224	\N	RUS	\N	\N	\N
10831	caleb-jones	Caleb Jones	D	325	\N	\N	\N	\N	\N	1997-06-06	\N	6'1	\N	L	184	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6333	6333	jamie-drysdale
450	tomas-hertl	Tomas Hertl	C	36	8476881	48	\N	\N	\N	1993-11-12	Praha, CZE	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476881.png	L	220	\N	CZE	\N	\N	\N
479	ryan-leonard	Ryan Leonard	R	37	8484186	9	\N	\N	\N	2005-01-21	Northampton, Massachusetts, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484186.png	R	205	\N	USA	\N	\N	\N
486	alex-tuch	Alex Tuch	R	37	8477949	89	\N	\N	\N	1996-05-10	Syracuse, New York, USA	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477949.png	R	219	\N	USA	\N	\N	\N
512	mario-ferraro	Mario Ferraro	D	38	8479983	38	\N	\N	\N	1998-09-17	Toronto, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479983.png	L	200	\N	CAN	\N	\N	\N
520	leo-carlsson	Leo Carlsson	C	7	8484153	91	\N	\N	\N	2004-12-26	Karlstad, SWE	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484153.png	L	208	\N	SWE	\N	\N	\N
5153	noel-nordh	Noel Nordh	F	323	\N	\N	\N	\N	\N	2005-01-25	\N	6'2	\N	L	196	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10214	10214	jamie-drysdale
345	conor-geekie	Conor Geekie	C	320	8483447	14	\N	\N	\N	2004-05-05	Strathclair, Manitoba, CAN	6'4	https://assets.nhle.com/mugs/nhl/latest/168x168/8483447.png	L	212	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9202	9202	jamie-drysdale
549	ville-husso	Ville Husso	G	7	8478024	33	\N	\N	\N	1995-02-06	Helsinki, FIN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478024.png	L	205	\N	FIN	\N	\N	\N
5141	matt-strome	Matt Strome	C	307	\N	\N	\N	\N	\N	1999-01-06	\N	6.04	\N	L	206	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7584	7584	jamie-drysdale
555	marat-khusnutdinov	Marat Khusnutdinov	C	3	8482177	92	\N	\N	\N	2002-07-17	Moscow, RUS	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482177.png	L	184	\N	RUS	\N	\N	\N
576	justin-danforth	Justin Danforth	R	9	8479941	15	\N	\N	\N	1993-03-15	Oshawa, Ontario, CAN	5'8"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479941.png	R	193	\N	CAN	\N	\N	\N
184	adam-sykora	Adam Sykora	F	305	8483669	38	\N	\N	\N	2004-09-07	Piestany, SVK	5'11	https://assets.nhle.com/mugs/nhl/latest/168x168/8483669.png	L	193	\N	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9666	9666	jamie-drysdale
585	josh-norris	Josh Norris	C	9	8480064	9	\N	\N	\N	1999-05-05	Oxford, Michigan, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480064.png	L	196	\N	USA	\N	\N	\N
611	tyson-gross	Tyson Gross	C	10	8486056	39	\N	\N	\N	2002-09-23	Calgary, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8486056.png	R	195	\N	CAN	\N	\N	\N
806	brady-tkachuk	Brady Tkachuk	L	18	8480801	8	\N	\N	\N	1999-09-16	Scottsdale, Arizona, USA	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480801.png	L	226	\N	USA	\N	\N	\N
646	jordan-staal	Jordan Staal	C	11	8473533	11	\N	\N	\N	1988-09-10	Thunder Bay, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8473533.png	L	220	\N	CAN	\N	\N	\N
652	alexander-nikishin	Alexander Nikishin	D	11	8482100	21	\N	\N	\N	2001-10-02	Orel, RUS	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482100.png	L	218	\N	RUS	\N	\N	\N
681	arvid-soderblom	Arvid Soderblom	G	12	8482821	40	\N	\N	\N	1999-08-19	Göteborg, SWE	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482821.png	L	180	\N	SWE	\N	\N	\N
695	brent-burns	Brent Burns	D	13	8470613	84	\N	\N	\N	1985-03-09	Barrie, Ontario, CAN	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8470613.png	R	228	\N	CAN	\N	\N	\N
709	isac-lundestrm	Isac Lundeström	C	14	8480806	21	\N	\N	\N	1999-11-06	Gallivare, SWE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480806.png	L	192	\N	SWE	\N	\N	\N
723	zach-werenski	Zach Werenski	D	14	8478460	8	\N	\N	\N	1997-07-19	Grosse Pointe, Michigan, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478460.png	L	214	\N	USA	\N	\N	\N
742	thomas-harley	Thomas Harley	D	15	8481581	55	\N	\N	\N	2001-08-19	Syracuse, New York, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481581.png	L	214	\N	USA	\N	\N	\N
756	keegan-kolesar	Keegan Kolesar	R	16	8478434	\N	\N	\N	\N	1997-04-08	Brandon, Manitoba, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478434.png	R	216	\N	CAN	\N	\N	\N
10	kasperi-kapanen	Kasperi Kapanen	R	1	8477953	42	\N	\N	\N	1996-07-23	Kuopio, FIN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477953.png	R	194	\N	FIN	\N	\N	\N
25	joel-armia	Joel Armia	R	19	8476469	40	\N	\N	\N	1993-05-31	Pori, FIN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476469.png	R	215	\N	FIN	\N	\N	\N
40	cody-ceci	Cody Ceci	D	19	8476879	5	\N	\N	\N	1993-12-21	Ottawa, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476879.png	R	210	\N	CAN	\N	\N	\N
75	riley-mercer	Riley Mercer	G	20	8483918	50	\N	\N	\N	2004-03-31	Bay Roberts, Newfoundland and Labrador, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483918.png	L	200	\N	CAN	\N	\N	\N
101	maksymilian-szuber	Maksymilian Szuber	D	21	8483763	\N	\N	\N	\N	2002-08-25	Opole, POL	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483763.png	L	215	\N	POL	\N	\N	\N
109	adam-edstrom	Adam Edstrom	C	22	8481726	\N	\N	\N	\N	2000-10-12	Karlstad, SWE	6'7"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481726.png	L	232	\N	SWE	\N	\N	\N
120	justin-barron	Justin Barron	D	22	8482111	20	\N	\N	\N	2001-11-15	Halifax, Nova Scotia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482111.png	R	198	\N	CAN	\N	\N	\N
140	stefan-noesen	Stefan Noesen	R	23	8476474	11	\N	\N	\N	1993-02-12	Plano, Texas, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476474.png	R	205	\N	USA	\N	\N	\N
163	tony-deangelo	Tony DeAngelo	D	24	8477950	77	\N	\N	\N	1995-10-24	Sewell, New Jersey, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477950.png	R	190	\N	USA	\N	\N	\N
196	dylan-garand	Dylan Garand	G	25	8482193	33	\N	\N	\N	2002-06-07	Victoria, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482193.png	L	185	\N	CAN	\N	\N	\N
326	ross-johnston	Ross Johnston	L	31	8477527	\N	\N	\N	\N	1994-02-18	Charlottetown, Prince Edward Island, CAN	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477527.png	L	232	\N	CAN	\N	\N	\N
372	brandon-duhaime	Brandon Duhaime	R	2	8479520	\N	\N	\N	\N	1997-05-22	Coral Springs, Florida, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479520.png	L	210	\N	USA	\N	\N	\N
394	anthony-stolarz	Anthony Stolarz	G	2	8476932	41	\N	\N	\N	1994-01-20	Edison, New Jersey, USA	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476932.png	L	248	\N	USA	\N	\N	\N
408	kevin-stenlund	Kevin Stenlund	C	34	8478831	82	\N	\N	\N	1996-09-20	Stockholm, SWE	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478831.png	R	213	\N	SWE	\N	\N	\N
443	nikita-tolopilo	Nikita Tolopilo	G	35	8484268	60	\N	\N	\N	2000-04-06	Minsk, BLR	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484268.png	L	229	\N	BLR	\N	\N	\N
4825	austin-poganski	Austin Poganski	R	323	\N	\N	\N	\N	\N	1996-02-16	\N	6'1	\N	R	206	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7069	7069	jamie-drysdale
4829	sasha-pastujov	Sasha Pastujov	R	317	\N	\N	\N	\N	\N	2003-07-15	\N	6'0	\N	L	186	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9189	9189	jamie-drysdale
4831	trey-fix-wolansky	Trey Fix-wolansky	F	305	\N	\N	\N	\N	\N	1999-05-26	\N	5'6	\N	R	193	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7669	7669	jamie-drysdale
4843	matej-blumel	Matej Blumel	L	314	\N	\N	\N	\N	\N	2000-05-31	\N	6'0	\N	L	202	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9533	9533	jamie-drysdale
4845	matthew-seminoff	Matthew Seminoff	F	321	\N	\N	\N	\N	\N	2003-12-27	\N	6'0	\N	R	189	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9961	9961	jamie-drysdale
4848	glenn-gawdin	Glenn Gawdin	F	313	\N	\N	\N	\N	\N	1997-03-25	\N	6'1	\N	R	195	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6784	6784	jamie-drysdale
4818	bradly-nadeau	Bradly Nadeau	F	300	\N	\N	\N	\N	\N	2005-05-05	\N	5'11	https://www.hockeydb.com/ihdb/photos/bradly-nadeau-2026-979.jpg	R	180	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10468	10468	jamie-drysdale
615	rory-kerins	Rory Kerins	C	298	8482209	6	\N	\N	\N	2002-04-12	Caledon, Ontario, CAN	5'10	https://assets.nhle.com/mugs/nhl/latest/168x168/8482209.png	L	175	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8617	8617	jamie-drysdale
4867	tristen-nielsen	Tristen Nielsen	F	303	\N	\N	\N	\N	\N	2000-02-23	\N	5'10	\N	L	192	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8929	8929	jamie-drysdale
401	cam-hebig	Cam Hebig	C	34	8479656	78	\N	\N	\N	1997-01-21	Saskatoon, Saskatchewan, CAN	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479656.png	R	184	\N	CAN	\N	\N	\N
4869	lukas-cormier	Lukas Cormier	D	306	\N	\N	\N	\N	\N	2002-03-27	\N	5'11	\N	L	184	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9278	9278	jamie-drysdale
4796	cameron-hughes	Cameron Hughes	F	321	\N	\N	\N	\N	\N	1996-10-09	\N	6'0	\N	L	190	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7016	7016	jamie-drysdale
4861	andre-lee	Andre Lee	F	313	\N	\N	\N	\N	\N	2000-07-26	\N	6'4	https://www.hockeydb.com/ihdb/photos/anders-lee-2026-9331.jpg	L	210	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9081	9081	jamie-drysdale
4798	arthur-kaliyev	Arthur Kaliyev	L	297	\N	\N	\N	\N	\N	2001-06-26	\N	6'2	\N	L	212	\N	UZB	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7677	7677	jamie-drysdale
4809	zac-jones	Zac Jones	D	315	\N	\N	\N	\N	\N	2000-10-18	\N	5'11	\N	L	190	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8864	8864	jamie-drysdale
4812	filip-bystedt	Filip Bystedt	F	318	\N	\N	\N	\N	\N	2004-02-04	\N	6'2	\N	L	187	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10086	10086	jamie-drysdale
4816	logan-morrison	Logan Morrison	F	302	\N	\N	\N	\N	\N	2002-07-09	\N	6'0	\N	R	180	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9756	9756	jamie-drysdale
4858	ryan-carpenter	Ryan Carpenter	C	317	\N	\N	\N	\N	\N	1991-01-18	\N	6.01	\N	R	201	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5461	5461	jamie-drysdale
4838	cole-guttman	Cole Guttman	F	313	\N	\N	\N	\N	\N	1999-04-06	\N	5'9	\N	R	167	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9357	9357	jamie-drysdale
430	elias-pettersson	Elias Pettersson	D	295	8483678	25	\N	\N	\N	1998-11-12	Vasteras, SWE	6'2	https://assets.nhle.com/mugs/nhl/latest/168x168/8483678.png	L	176	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10027	10027	jamie-drysdale
4822	mitchell-chaffee	Mitchell Chaffee	R	320	\N	\N	\N	\N	\N	1998-01-26	\N	6'1	\N	R	197	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8553	8553	jamie-drysdale
4849	isaac-howard	Isaac Howard	L	296	\N	\N	\N	\N	\N	2004-03-30	\N	5'10	\N	L	180	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10933	10933	jamie-drysdale
423	filip-chytil	Filip Chytil	C	35	8480078	72	\N	\N	\N	1999-09-05	Kromeriz, CZE	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480078.png	L	210	\N	CZE	\N	\N	\N
4834	logan-shaw	Logan Shaw	F	322	\N	\N	\N	\N	\N	1992-10-05	\N	6'3	\N	R	208	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4573	4573	jamie-drysdale
4802	seth-griffith	Seth Griffith	R	296	\N	\N	\N	\N	\N	1993-01-04	\N	5'9	\N	R	190	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5080	5080	jamie-drysdale
4853	t-j-tynan	T.j. Tynan	F	303	\N	\N	\N	\N	\N	1992-02-25	\N	5.08	\N	R	160	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5540	5540	jamie-drysdale
4820	jagger-firkus	Jagger Firkus	F	302	\N	\N	\N	\N	\N	2004-04-29	\N	5'10	\N	R	153	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9755	9755	jamie-drysdale
4805	justin-robidas	Justin Robidas	F	300	\N	\N	\N	\N	\N	2003-03-13	\N	5'8	\N	R	176	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10469	10469	jamie-drysdale
5143	will-butcher	Will Butcher	D	301	\N	\N	\N	\N	\N	1995-01-06	\N	5.10	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9532	9532	jamie-drysdale
818	jacob-markstrom	Jacob Markstrom	G	18	8474593	25	\N	\N	\N	1990-01-31	Gavle, SWE	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8474593.png	L	207	\N	SWE	\N	\N	\N
146	johnathan-kovacevic	Johnathan Kovacevic	D	23	8480192	8	\N	\N	\N	1997-07-12	Hamilton, Ontario, CAN	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480192.png	R	223	\N	CAN	\N	\N	\N
703	scott-wedgewood	Scott Wedgewood	G	13	8475809	41	\N	\N	\N	1992-08-14	Brampton, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475809.png	L	201	\N	CAN	\N	\N	\N
3	jason-dickinson	Jason Dickinson	C	1	8477450	16	\N	\N	\N	1995-07-04	Georgetown, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477450.png	L	200	\N	CAN	\N	\N	\N
412	nick-desimone	Nick DeSimone	D	34	8480084	57	\N	\N	\N	1994-11-21	East Amherst, New York, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480084.png	R	194	\N	USA	\N	\N	\N
238	jett-luchanko	Jett Luchanko	C	27	8484779	17	\N	\N	\N	2006-08-21	London, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484779.png	R	180	\N	CAN	\N	\N	\N
4856	matthew-peca	Matthew Peca	C	320	\N	\N	\N	\N	\N	1993-04-27	\N	5'10	https://www.hockeydb.com/ihdb/photos/matt-beca-2013-6054.jpg	L	181	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5896	5896	jamie-drysdale
5324	brendan-warren	Brendan Warren	R	315	\N	\N	\N	\N	\N	1997-05-07	\N	6.00	\N	L	191	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8705	8705	jamie-drysdale
4991	christian-wolanin	Christian Wolanin	D	314	\N	\N	\N	\N	\N	1995-03-17	\N	6.02	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7378	7378	jamie-drysdale
4899	gerry-mayhew	Gerry Mayhew	C	308	\N	\N	\N	\N	\N	1992-12-31	\N	5.09	\N	R	161	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6616	6616	jamie-drysdale
4923	mitch-mclain	Mitch Mclain	F	306	\N	\N	\N	\N	\N	1993-12-09	\N	6.00	\N	R	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7028	7028	jamie-drysdale
4886	quentin-musty	Quentin Musty	F	318	\N	\N	\N	\N	\N	2005-07-06	\N	6'2	\N	L	200	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10234	10234	jamie-drysdale
5160	william-lagesson	William Lagesson	D	304	\N	\N	\N	\N	\N	1996-02-22	\N	6'2	\N	L	211	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7404	7404	jamie-drysdale
4957	kyle-criscuolo	Kyle Criscuolo	C	324	\N	\N	\N	\N	\N	1992-05-05	\N	5.09	\N	R	178	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6262	6262	jamie-drysdale
4898	fabian-lysell	Fabian Lysell	R	314	\N	\N	\N	\N	\N	2003-01-19	\N	5'11	\N	R	186	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9524	9524	jamie-drysdale
4901	jack-becker	Jack Becker	F	321	\N	\N	\N	\N	\N	1997-06-24	\N	6'3	\N	R	191	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9456	9456	jamie-drysdale
4904	nils-aman	Nils Aman	C	295	\N	\N	\N	\N	\N	2000-02-07	\N	6'2	\N	L	179	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9406	9406	jamie-drysdale
4909	kenny-connors	Kenny Connors	F	313	\N	\N	\N	\N	\N	2003-03-10	\N	6'1	\N	L	199	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10705	10705	jamie-drysdale
4912	valtteri-puustinen	Valtteri Puustinen	R	303	\N	\N	\N	\N	\N	1999-06-04	\N	5'11	\N	R	180	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8793	8793	jamie-drysdale
4914	andrew-agozzino	Andrew Agozzino	C	323	\N	\N	\N	\N	\N	1991-01-03	\N	5'10	\N	L	187	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=3642	3642	jamie-drysdale
4917	calle-rosen	Calle Rosen	D	319	\N	\N	\N	\N	\N	1994-02-02	\N	6'1	\N	L	188	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6917	6917	jamie-drysdale
4920	frederic-brunet	Frederic Brunet	D	314	\N	\N	\N	\N	\N	2003-08-21	\N	6'3	\N	L	200	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9712	9712	jamie-drysdale
4929	dillon-dube	Dillon Dube	L	319	\N	\N	\N	\N	\N	1998-07-20	\N	5'11	\N	L	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6786	6786	jamie-drysdale
4932	sam-morton	Sam Morton	C	298	\N	\N	\N	\N	\N	1999-07-28	\N	6'0	\N	L	185	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10037	10037	jamie-drysdale
4935	wilmer-skoog	Wilmer Skoog	F	299	\N	\N	\N	\N	\N	1999-07-17	\N	6'2	\N	L	196	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9990	9990	jamie-drysdale
4939	christian-kyrou	Christian Kyrou	D	310	\N	\N	\N	\N	\N	2003-09-16	\N	5'11	\N	R	173	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9963	9963	jamie-drysdale
4943	domenick-fensore	Domenick Fensore	D	300	\N	\N	\N	\N	\N	2001-09-07	\N	5'9	\N	L	175	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10001	10001	jamie-drysdale
4947	ryan-tverberg	Ryan Tverberg	F	322	\N	\N	\N	\N	\N	2002-01-30	\N	5'11	\N	R	187	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9624	9624	jamie-drysdale
5156	sawyer-mynio	Sawyer Mynio	D	295	\N	\N	\N	\N	\N	2005-04-30	\N	6'1	\N	L	173	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10077	10077	jamie-drysdale
4953	jacob-quillan	Jacob Quillan	C	322	\N	\N	\N	\N	\N	2002-02-02	\N	6'1	\N	L	204	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10091	10091	jamie-drysdale
4956	kole-lind	Kole Lind	F	321	\N	\N	\N	\N	\N	1998-10-16	\N	6'2	\N	R	190	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7101	7101	jamie-drysdale
4961	samuel-fagemo	Samuel Fagemo	L	311	\N	\N	\N	\N	\N	2000-03-14	\N	6'0	\N	R	200	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7680	7680	jamie-drysdale
4965	danila-klimovich	Danila Klimovich	R	295	\N	\N	\N	\N	\N	2003-01-09	\N	6'2	\N	R	202	\N	BLR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8928	8928	jamie-drysdale
4970	sam-colangelo	Sam Colangelo	F	317	\N	\N	\N	\N	\N	2001-12-26	\N	6'2	\N	R	213	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10096	10096	jamie-drysdale
4973	jani-nyman	Jani Nyman	F	302	\N	\N	\N	\N	\N	2004-07-30	\N	6'2	\N	L	212	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10127	10127	jamie-drysdale
4975	louie-belpedio	Louie Belpedio	D	307	\N	\N	\N	\N	\N	1996-05-14	\N	5'11	\N	R	197	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7024	7024	jamie-drysdale
4982	gustav-olofsson	Gustav Olofsson	D	302	\N	\N	\N	\N	\N	1994-12-01	\N	6'2	\N	L	199	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5471	5471	jamie-drysdale
4987	tye-felhaber	Tye Felhaber	F	303	\N	\N	\N	\N	\N	1998-08-05	\N	5'11	\N	L	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7090	7090	jamie-drysdale
4989	calen-addison	Calen Addison	D	324	\N	\N	\N	\N	\N	2000-04-11	\N	5'11	\N	R	173	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7624	7624	jamie-drysdale
4880	luca-pinelli	Luca Pinelli	L	301	\N	\N	\N	\N	\N	2005-04-05	\N	5'9	\N	L	176	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10176	10176	jamie-drysdale
4878	jack-devine	Jack Devine	F	299	\N	\N	\N	\N	\N	2003-10-01	\N	5'11	\N	R	173	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10615	10615	jamie-drysdale
4884	cole-o-hara	Cole O'hara	R	312	\N	\N	\N	\N	\N	2002-06-20	\N	6'0	https://www.hockeydb.com/ihdb/photos/cole-o'hara-2026-1412.jpg	R	189	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10609	10609	jamie-drysdale
4950	evan-vierling	Evan Vierling	F	300	\N	\N	\N	\N	\N	2002-06-20	\N	6.00	\N	L	178	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9807	9807	jamie-drysdale
357	scott-sabourin	Scott Sabourin	R	320	8477149	46	\N	\N	\N	1992-07-30	Orleans, Ontario, CAN	6'3	https://assets.nhle.com/mugs/nhl/latest/168x168/8477149.png	R	205	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4910	4910	jamie-drysdale
4984	matteo-pietroniro	Matteo Pietroniro	D	320	\N	\N	\N	\N	\N	1998-10-20	\N	5.10	\N	R	189	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8884	8884	jamie-drysdale
4998	michael-benning	Michael Benning	D	299	\N	\N	\N	\N	\N	2002-01-05	\N	5.09	\N	R	177	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9988	9988	jamie-drysdale
5097	j-r-avon	J.r. Avon	F	302	\N	\N	\N	\N	\N	2003-07-04	\N	6.00	\N	L	174	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9992	9992	jamie-drysdale
5104	nikolas-brouillard	Nikolas Brouillard	D	317	\N	\N	\N	\N	\N	1995-02-07	\N	5.10	\N	L	172	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6442	6442	jamie-drysdale
5784	sam-stevens	Sam Stevens	C	322	\N	\N	\N	\N	\N	2000-04-27	\N	6.02	\N	L	194	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10160	10160	jamie-drysdale
5037	curtis-mckenzie	Curtis Mckenzie	F	321	\N	\N	\N	\N	\N	1991-02-22	\N	6.02	\N	L	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4883	4883	jamie-drysdale
5009	william-villeneuve	William Villeneuve	D	322	\N	\N	\N	\N	\N	2002-03-20	\N	6'2	\N	R	183	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8738	8738	jamie-drysdale
5090	alex-suzdalev	Alex Suzdalev	R	307	\N	\N	\N	\N	\N	2004-03-05	\N	6.02	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9734	9734	jamie-drysdale
5030	michael-karow	Michael Karow	D	321	\N	\N	\N	\N	\N	1998-12-18	\N	6.02	\N	L	201	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9075	9075	jamie-drysdale
5019	justin-dowling	Justin Dowling	C	305	\N	\N	\N	\N	\N	1990-10-01	\N	5'11	\N	L	178	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4053	4053	jamie-drysdale
5048	zayde-wisdom	Zayde Wisdom	C	310	\N	\N	\N	\N	\N	2002-07-07	\N	6.00	\N	R	175	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8451	8451	jamie-drysdale
5052	chase-wouters	Chase Wouters	C	295	\N	\N	\N	\N	\N	2000-02-08	\N	6.00	\N	R	182	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7696	7696	jamie-drysdale
5022	sammy-walker	Sammy Walker	F	323	\N	\N	\N	\N	\N	1999-06-07	\N	5'10	\N	R	180	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9396	9396	jamie-drysdale
5025	yegor-sidorov	Yegor Sidorov	R	317	\N	\N	\N	\N	\N	2004-06-18	\N	6'0	\N	L	184	\N	BLR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10274	10274	jamie-drysdale
5032	ondrej-becher	Ondrej Becher	C	304	\N	\N	\N	\N	\N	2004-02-22	\N	6'2	\N	L	198	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10479	10479	jamie-drysdale
5034	ryan-schmelzer	Ryan Schmelzer	C	324	\N	\N	\N	\N	\N	1993-07-28	\N	6'2	\N	R	188	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7251	7251	jamie-drysdale
5038	ethan-gauthier	Ethan Gauthier	R	320	\N	\N	\N	\N	\N	2005-01-26	\N	6'0	\N	R	184	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10607	10607	jamie-drysdale
5041	lucas-mercuri	Lucas Mercuri	C	320	\N	\N	\N	\N	\N	2002-03-07	\N	6'3	\N	R	222	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10566	10566	jamie-drysdale
5043	mitchell-stephens	Mitchell Stephens	F	302	\N	\N	\N	\N	\N	1997-02-05	\N	6'0	\N	R	203	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6306	6306	jamie-drysdale
5046	tucker-robertson	Tucker Robertson	F	310	\N	\N	\N	\N	\N	2003-06-22	\N	5'11	\N	R	188	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9768	9768	jamie-drysdale
5059	jonas-r-ndbjerg	JONAS RøNDBJERG	F	306	\N	\N	\N	\N	\N	1999-03-31	\N	6'2	\N	L	206	\N	DNK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7760	7760	jamie-drysdale
5065	matyas-melovsky	Matyas Melovsky	F	324	\N	\N	\N	\N	\N	2004-05-25	\N	6'1	\N	R	190	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10815	10815	jamie-drysdale
5070	trey-taylor	Trey Taylor	D	321	\N	\N	\N	\N	\N	2002-02-04	\N	6'2	\N	L	196	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10535	10535	jamie-drysdale
5074	borya-valis	Borya Valis	F	322	\N	\N	\N	\N	\N	2004-04-08	\N	6'2	\N	R	195	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10613	10613	jamie-drysdale
5077	hunter-mckown	Hunter Mckown	C	301	\N	\N	\N	\N	\N	2002-08-18	\N	6'1	\N	R	192	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9980	9980	jamie-drysdale
5079	jared-davidson	Jared Davidson	F	309	\N	\N	\N	\N	\N	2002-07-07	\N	5'11	\N	L	183	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9796	9796	jamie-drysdale
5084	lassi-thomson	Lassi Thomson	D	297	\N	\N	\N	\N	\N	2000-09-24	\N	6'0	\N	R	195	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8590	8590	jamie-drysdale
5086	nick-cicek	Nick Cicek	D	298	\N	\N	\N	\N	\N	2000-05-29	\N	6'3	\N	L	201	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8741	8741	jamie-drysdale
5088	roman-ahcan	Roman Ahcan	L	301	\N	\N	\N	\N	\N	1999-03-24	\N	5'9	\N	L	170	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9025	9025	jamie-drysdale
5099	john-hayden	John Hayden	F	302	\N	\N	\N	\N	\N	1995-02-14	\N	6'3	\N	R	223	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6956	6956	jamie-drysdale
5102	koehn-ziemmer	Koehn Ziemmer	F	313	\N	\N	\N	\N	\N	2004-12-08	\N	6'0	\N	R	202	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9785	9785	jamie-drysdale
5108	tristan-allard	Tristan Allard	C	320	\N	\N	\N	\N	\N	2002-06-23	\N	6'0	\N	L	217	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9754	9754	jamie-drysdale
5110	viktor-neuchev	Viktor Neuchev	R	300	\N	\N	\N	\N	\N	2003-10-25	\N	5'11	\N	L	180	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9927	9927	jamie-drysdale
4995	hugh-mcging	Hugh Mcging	F	319	\N	\N	\N	\N	\N	1998-07-11	\N	5'8	\N	L	174	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8461	8461	jamie-drysdale
4999	nolan-foote	Nolan Foote	L	299	\N	\N	\N	\N	\N	2000-11-29	\N	6'3	\N	L	196	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8405	8405	jamie-drysdale
5001	samuel-bolduc	Samuel Bolduc	D	297	\N	\N	\N	\N	\N	2000-12-09	\N	6'4	\N	L	224	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7822	7822	jamie-drysdale
5066	max-szuber	Max Szuber	D	323	\N	\N	\N	\N	\N	2002-08-25	\N	6.03	\N	L	220	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9217	9217	jamie-drysdale
5068	roland-mckeown	Roland Mckeown	D	317	\N	\N	\N	\N	\N	1996-01-20	\N	6.01	\N	R	194	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5912	5912	jamie-drysdale
5027	brendan-furry	Brendan Furry	L	320	\N	\N	\N	\N	\N	1998-07-08	\N	6.01	\N	L	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9693	9693	jamie-drysdale
5154	nolan-allan	Nolan Allan	D	318	\N	\N	\N	\N	\N	2003-04-28	\N	6'2	\N	L	195	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9153	9153	jamie-drysdale
5158	thomas-bordeleau	Thomas Bordeleau	F	319	\N	\N	\N	\N	\N	2002-01-03	\N	5'10	\N	L	180	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9114	9114	jamie-drysdale
5161	caedan-bankier	Caedan Bankier	C	308	\N	\N	\N	\N	\N	2003-01-26	\N	6'2	\N	L	192	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9859	9859	jamie-drysdale
5164	kirill-kudryavtsev	Kirill Kudryavtsev	D	295	\N	\N	\N	\N	\N	2004-02-05	\N	5'11	\N	L	200	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10452	10452	jamie-drysdale
5243	zach-aston-reese	Zach Aston-reese	L	301	\N	\N	\N	\N	\N	1994-08-10	\N	6.01	\N	L	203	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6644	6644	jamie-drysdale
5166	nathan-legare	Nathan Legare	R	324	\N	\N	\N	\N	\N	2001-01-11	\N	6'0	\N	R	200	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8891	8891	jamie-drysdale
5131	akil-thomas	Akil Thomas	F	319	\N	\N	\N	\N	\N	2000-01-02	\N	6'0	\N	R	195	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7682	7682	jamie-drysdale
5134	damien-carfagna	Damien Carfagna	D	296	\N	\N	\N	\N	\N	2002-12-12	\N	5'11	\N	L	170	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10594	10594	jamie-drysdale
5136	henry-thrun	Henry Thrun	D	322	\N	\N	\N	\N	\N	2001-03-12	\N	6'2	\N	L	211	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9994	9994	jamie-drysdale
5138	jan-mysak	Jan Mysak	C	317	\N	\N	\N	\N	\N	2002-06-24	\N	5'11	\N	L	201	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8535	8535	jamie-drysdale
5140	joey-willis	Joey Willis	L	312	\N	\N	\N	\N	\N	2005-03-14	\N	5'11	\N	L	184	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10833	10833	jamie-drysdale
5169	ty-gallagher	Ty Gallagher	D	314	\N	\N	\N	\N	\N	2003-03-06	\N	6'0	\N	R	188	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10508	10508	jamie-drysdale
5175	carson-rehkopf	Carson Rehkopf	F	302	\N	\N	\N	\N	\N	2005-01-07	\N	6'3	\N	L	206	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10180	10180	jamie-drysdale
5177	gabriel-szturc	Gabriel Szturc	C	320	\N	\N	\N	\N	\N	2003-09-24	\N	5'11	\N	L	191	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9901	9901	jamie-drysdale
5182	lukas-reichel	Lukas Reichel	C	314	\N	\N	\N	\N	\N	2002-05-17	\N	6'0	\N	L	170	\N	DEU	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8847	8847	jamie-drysdale
5186	owen-allard	Owen Allard	F	323	\N	\N	\N	\N	\N	2004-01-13	\N	6'2	\N	L	190	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10208	10208	jamie-drysdale
5128	ty-tullio	Ty Tullio	R	323	\N	\N	\N	\N	\N	2002-04-05	\N	6.00	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8631	8631	jamie-drysdale
5191	cal-foote	Cal Foote	D	300	\N	\N	\N	\N	\N	1998-12-13	\N	6'5	\N	R	224	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7089	7089	jamie-drysdale
5194	ethan-samson	Ethan Samson	D	320	\N	\N	\N	\N	\N	2003-08-23	\N	6'1	\N	R	180	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9823	9823	jamie-drysdale
5196	hudson-fasching	Hudson Fasching	R	301	\N	\N	\N	\N	\N	1995-07-28	\N	6'3	\N	R	214	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6516	6516	jamie-drysdale
5199	james-malatesta	James Malatesta	L	301	\N	\N	\N	\N	\N	2003-05-31	\N	5'9	\N	L	193	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9978	9978	jamie-drysdale
5201	jimmy-schuldt	Jimmy Schuldt	D	295	\N	\N	\N	\N	\N	1995-05-11	\N	6'1	\N	L	203	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7767	7767	jamie-drysdale
5205	mikulas-hovorka	Mikulas Hovorka	D	299	\N	\N	\N	\N	\N	2001-07-01	\N	6'6	\N	R	229	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10459	10459	jamie-drysdale
5216	jan-jenik	Jan Jenik	F	313	\N	\N	\N	\N	\N	2000-09-15	\N	6'1	\N	L	204	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7713	7713	jamie-drysdale
5219	michal-kunc	Michal Kunc	F	323	\N	\N	\N	\N	\N	2000-10-31	\N	6'0	\N	L	187	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10668	10668	jamie-drysdale
5222	noah-philp	Noah Philp	C	300	\N	\N	\N	\N	\N	1998-08-31	\N	6'3	\N	R	198	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7605	7605	jamie-drysdale
5189	scott-harrington	Scott Harrington	D	297	\N	\N	\N	\N	\N	1993-03-10	\N	6.01	\N	L	217	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4955	4955	jamie-drysdale
5227	anton-blidh	Anton Blidh	F	305	\N	\N	\N	\N	\N	1995-03-14	\N	6'1	\N	L	191	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5995	5995	jamie-drysdale
5229	cam-squires	Cam Squires	F	324	\N	\N	\N	\N	\N	2005-04-11	\N	6'0	\N	R	165	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10621	10621	jamie-drysdale
5231	colby-barlow	Colby Barlow	R	311	\N	\N	\N	\N	\N	2005-02-14	\N	6'0	\N	L	190	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10121	10121	jamie-drysdale
5113	casey-fitzgerald	Casey Fitzgerald	D	305	\N	\N	\N	\N	\N	1997-02-25	\N	5'11	\N	R	188	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7569	7569	jamie-drysdale
5122	noah-chadwick	Noah Chadwick	D	322	\N	\N	\N	\N	\N	2005-05-10	\N	6'4	\N	L	207	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10119	10119	jamie-drysdale
5118	isaac-ratcliffe	Isaac Ratcliffe	L	312	\N	\N	\N	\N	\N	1999-02-15	\N	6.05	\N	L	203	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7121	7121	jamie-drysdale
5146	gabriel-seger	Gabriel Seger	L	304	\N	\N	\N	\N	\N	1999-11-15	\N	6'4	\N	L	216	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10475	10475	jamie-drysdale
5124	sean-behrens	Sean Behrens	D	303	\N	\N	\N	\N	\N	2003-03-31	\N	5'10	\N	L	177	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10163	10163	jamie-drysdale
5148	joe-hicketts	Joe Hicketts	D	313	\N	\N	\N	\N	\N	1996-05-04	\N	5'8	\N	L	176	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5976	5976	jamie-drysdale
5142	ronan-seeley	Ronan Seeley	D	300	\N	\N	\N	\N	\N	2002-08-02	\N	6'0	\N	L	201	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9168	9168	jamie-drysdale
5152	mike-hardman	Mike Hardman	L	324	\N	\N	\N	\N	\N	1999-02-05	\N	6'2	\N	L	205	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8910	8910	jamie-drysdale
5224	robbie-russo	Robbie Russo	D	323	\N	\N	\N	\N	\N	1993-02-15	\N	6.00	\N	R	195	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6037	6037	jamie-drysdale
5260	tyler-pitlick	Tyler Pitlick	F	308	\N	\N	\N	\N	\N	1991-11-01	\N	6'2	\N	R	199	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4216	4216	jamie-drysdale
5264	brad-lambert	Brad Lambert	F	311	\N	\N	\N	\N	\N	2003-12-19	\N	6'1	\N	R	173	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9557	9557	jamie-drysdale
5267	dominik-badinka	Dominik Badinka	D	300	\N	\N	\N	\N	\N	2005-11-27	\N	6'3	\N	R	199	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10622	10622	jamie-drysdale
5272	marc-mclaughlin	Marc Mclaughlin	F	324	\N	\N	\N	\N	\N	1999-07-26	\N	6'0	\N	R	202	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9036	9036	jamie-drysdale
5276	shai-buium	Shai Buium	D	304	\N	\N	\N	\N	\N	2003-03-26	\N	6'3	\N	L	216	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10155	10155	jamie-drysdale
5278	zach-dean	Zach Dean	F	319	\N	\N	\N	\N	\N	2003-01-04	\N	6'0	\N	L	176	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9268	9268	jamie-drysdale
5281	andrew-gibson	Andrew Gibson	D	312	\N	\N	\N	\N	\N	2005-02-13	\N	6'4	\N	R	211	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10185	10185	jamie-drysdale
5286	devin-kaplan	Devin Kaplan	F	310	\N	\N	\N	\N	\N	2004-01-10	\N	6'2	\N	R	199	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10717	10717	jamie-drysdale
5319	xavier-simoneau	Xavier Simoneau	C	309	\N	\N	\N	\N	\N	2001-05-19	\N	5.07	\N	L	180	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9523	9523	jamie-drysdale
5321	bennett-schimek	Bennett Schimek	R	295	\N	\N	\N	\N	\N	2003-04-15	\N	6.00	\N	R	192	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10974	10974	jamie-drysdale
5292	kirill-kirsanov	Kirill Kirsanov	D	313	\N	\N	\N	\N	\N	2002-09-19	\N	6'1	\N	L	198	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10712	10712	jamie-drysdale
5323	brendan-hoffmann	Brendan Hoffmann	F	318	\N	\N	\N	\N	\N	2001-10-09	\N	6.03	\N	R	223	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10964	10964	jamie-drysdale
5298	ayrton-martino	Ayrton Martino	F	321	\N	\N	\N	\N	\N	2002-09-28	\N	5'11	\N	L	186	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10522	10522	jamie-drysdale
5303	gavin-white	Gavin White	D	298	\N	\N	\N	\N	\N	2002-11-12	\N	6'1	\N	R	195	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9962	9962	jamie-drysdale
5306	julian-lutz	Julian Lutz	F	323	\N	\N	\N	\N	\N	2004-02-29	\N	6'1	\N	L	185	\N	DEU	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9207	9207	jamie-drysdale
5308	luke-prokop	Luke Prokop	D	296	\N	\N	\N	\N	\N	2002-05-06	\N	6'6	\N	R	224	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9384	9384	jamie-drysdale
5311	matvey-petrov	Matvey Petrov	R	296	\N	\N	\N	\N	\N	2003-03-12	\N	6'2	\N	R	178	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9942	9942	jamie-drysdale
5313	pavol-regenda	Pavol Regenda	L	318	\N	\N	\N	\N	\N	1999-12-07	\N	6'3	\N	L	215	\N	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9190	9190	jamie-drysdale
5316	tobias-bjornfot	Tobias Bjornfot	D	299	\N	\N	\N	\N	\N	2001-04-06	\N	6'0	\N	L	200	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7687	7687	jamie-drysdale
5329	jake-wise	Jake Wise	F	303	\N	\N	\N	\N	\N	2000-02-28	\N	5.10	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9723	9723	jamie-drysdale
5340	nick-poisson	Nick Poisson	C	295	\N	\N	\N	\N	\N	2001-08-15	\N	5.11	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10931	10931	jamie-drysdale
5345	tobie-bisson	Tobie Bisson	D	309	\N	\N	\N	\N	\N	1997-02-01	\N	6.03	\N	L	207	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7274	7274	jamie-drysdale
5351	david-silye	David Silye	C	298	\N	\N	\N	\N	\N	1999-03-02	\N	5.11	\N	R	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10103	10103	jamie-drysdale
5334	mackenzie-entwistle	Mackenzie Entwistle	R	299	\N	\N	\N	\N	\N	1999-07-14	\N	6'3	\N	R	203	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8011	8011	jamie-drysdale
5336	michael-buchinger	Michael Buchinger	D	319	\N	\N	\N	\N	\N	2004-04-25	\N	6'0	\N	L	199	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9737	9737	jamie-drysdale
5338	miko-matikka	Miko Matikka	F	323	\N	\N	\N	\N	\N	2003-10-26	\N	6'3	\N	R	187	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10211	10211	jamie-drysdale
5578	travis-dermott	Travis Dermott	D	305	\N	\N	\N	\N	\N	1996-12-22	\N	6.00	\N	L	202	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6381	6381	jamie-drysdale
5343	simon-lundmark	Simon Lundmark	D	320	\N	\N	\N	\N	\N	2000-10-08	\N	6'2	\N	R	190	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8922	8922	jamie-drysdale
5348	caden-price	Caden Price	D	302	\N	\N	\N	\N	\N	2005-08-24	\N	6'1	\N	L	186	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10183	10183	jamie-drysdale
5235	luke-krys	Luke Krys	D	321	\N	\N	\N	\N	\N	2000-09-27	\N	6'1	\N	R	188	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10044	10044	jamie-drysdale
5240	tyler-thorpe	Tyler Thorpe	R	309	\N	\N	\N	\N	\N	2005-08-11	\N	6'5	\N	R	210	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10601	10601	jamie-drysdale
5296	turner-ottenbreit	Turner Ottenbreit	D	298	\N	\N	\N	\N	\N	1997-07-09	\N	6.03	\N	L	195	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7099	7099	jamie-drysdale
5245	cal-burke	Cal Burke	C	317	\N	\N	\N	\N	\N	1997-03-24	\N	5.10	\N	R	183	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8575	8575	jamie-drysdale
5248	ethan-cardwell	Ethan Cardwell	F	318	\N	\N	\N	\N	\N	2002-08-30	\N	5'11	\N	R	180	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9251	9251	jamie-drysdale
5287	donavan-houle	Donavan Houle	F	318	\N	\N	\N	\N	\N	1999-11-04	\N	6.01	\N	R	195	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10099	10099	jamie-drysdale
5250	jack-peart	Jack Peart	D	308	\N	\N	\N	\N	\N	2003-05-15	\N	5'11	\N	L	186	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10067	10067	jamie-drysdale
5256	nate-danielson	Nate Danielson	C	304	\N	\N	\N	\N	\N	2004-09-27	\N	6'2	\N	R	195	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10188	10188	jamie-drysdale
5253	martin-misiak	Martin Misiak	F	316	\N	\N	\N	\N	\N	2004-09-30	\N	6'2	\N	L	194	\N	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10142	10142	jamie-drysdale
5380	lucas-ciona	Lucas Ciona	L	298	\N	\N	\N	\N	\N	2003-01-08	\N	6'3	\N	L	210	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9952	9952	jamie-drysdale
5392	cooper-moore	Cooper Moore	D	305	\N	\N	\N	\N	\N	2001-02-16	\N	6.02	\N	L	187	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10735	10735	jamie-drysdale
5384	taige-harding	Taige Harding	D	316	\N	\N	\N	\N	\N	2002-01-03	\N	6'6	\N	L	235	\N	GBR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10563	10563	jamie-drysdale
5402	mark-duarte	Mark Duarte	R	297	\N	\N	\N	\N	\N	2002-09-27	\N	6.02	\N	R	187	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9684	9684	jamie-drysdale
5417	dalton-smith	Dalton Smith	L	307	\N	\N	\N	\N	\N	1992-06-30	\N	6.02	\N	L	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4604	4604	jamie-drysdale
5422	jalen-luypen	Jalen Luypen	C	307	\N	\N	\N	\N	\N	2002-06-28	\N	5.10	\N	L	171	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9711	9711	jamie-drysdale
5397	jackson-cates	Jackson Cates	F	316	\N	\N	\N	\N	\N	1997-09-26	\N	6'0	\N	L	201	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8768	8768	jamie-drysdale
5399	kalan-lind	Kalan Lind	L	312	\N	\N	\N	\N	\N	2005-01-25	\N	6'1	\N	L	162	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10554	10554	jamie-drysdale
5423	joe-arntsen	Joe Arntsen	D	295	\N	\N	\N	\N	\N	2003-05-22	\N	6.03	\N	L	210	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10146	10146	jamie-drysdale
5403	mason-millman	Mason Millman	D	296	\N	\N	\N	\N	\N	2001-07-18	\N	6'1	\N	L	175	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7847	7847	jamie-drysdale
5405	mikael-diotte	Mikael Diotte	D	324	\N	\N	\N	\N	\N	2003-04-10	\N	6'3	\N	R	205	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10442	10442	jamie-drysdale
5411	cam-allen	Cam Allen	D	307	\N	\N	\N	\N	\N	2005-01-07	\N	6'0	\N	R	194	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10133	10133	jamie-drysdale
5415	dakota-mermis	Dakota Mermis	D	322	\N	\N	\N	\N	\N	1994-01-05	\N	6'0	\N	L	197	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6014	6014	jamie-drysdale
5427	lucas-vanroboys	Lucas Vanroboys	F	318	\N	\N	\N	\N	\N	1999-07-24	\N	6.02	\N	R	175	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10100	10100	jamie-drysdale
5431	ryan-gagnier	Ryan Gagnier	C	316	\N	\N	\N	\N	\N	2002-07-16	\N	6.00	\N	L	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9840	9840	jamie-drysdale
5457	sean-chisholm	Sean Chisholm	F	321	\N	\N	\N	\N	\N	2001-01-26	\N	6.01	\N	L	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10527	10527	jamie-drysdale
5451	kyle-crnkovic	Kyle Crnkovic	F	318	\N	\N	\N	\N	\N	2002-10-02	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9808	9808	jamie-drysdale
5425	juuso-parssinen	Juuso Parssinen	C	305	\N	\N	\N	\N	\N	2001-02-01	\N	6'3	\N	L	207	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9164	9164	jamie-drysdale
5429	nikolai-knyzhov	Nikolai Knyzhov	D	295	\N	\N	\N	\N	\N	1998-03-20	\N	6'3	\N	L	222	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7746	7746	jamie-drysdale
5389	blake-hillman	Blake Hillman	D	305	\N	\N	\N	\N	\N	1996-01-26	\N	6.01	\N	L	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7433	7433	jamie-drysdale
5462	tommy-bergsland	Tommy Bergsland	D	321	\N	\N	\N	\N	\N	2001-03-23	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10517	10517	jamie-drysdale
5438	colton-huard	Colton Huard	D	299	\N	\N	\N	\N	\N	2000-11-27	\N	6'4	\N	R	225	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10507	10507	jamie-drysdale
5445	isaac-belliveau	Isaac Belliveau	D	315	\N	\N	\N	\N	\N	2002-11-26	\N	6'2	\N	L	193	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9803	9803	jamie-drysdale
5447	jakub-dvorak	Jakub Dvorak	D	313	\N	\N	\N	\N	\N	2005-05-25	\N	6'5	\N	L	203	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10199	10199	jamie-drysdale
5449	kai-schwindt	Kai Schwindt	F	299	\N	\N	\N	\N	\N	2003-12-07	\N	6'6	\N	L	197	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9721	9721	jamie-drysdale
5453	liam-mclinskey	Liam Mclinskey	F	299	\N	\N	\N	\N	\N	2001-02-20	\N	6'3	\N	R	165	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10550	10550	jamie-drysdale
5455	parker-bell	Parker Bell	L	298	\N	\N	\N	\N	\N	2003-09-26	\N	6'4	\N	L	192	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9726	9726	jamie-drysdale
5355	jakov-novak	Jakov Novak	F	302	\N	\N	\N	\N	\N	1998-10-22	\N	6.03	\N	L	216	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9797	9797	jamie-drysdale
5367	tommy-miller	Tommy Miller	D	320	\N	\N	\N	\N	\N	1999-03-06	\N	6.02	\N	R	202	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9079	9079	jamie-drysdale
5377	jack-millar	Jack Millar	D	313	\N	\N	\N	\N	\N	2000-11-30	\N	6.05	\N	R	220	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10125	10125	jamie-drysdale
5470	givani-smith	Givani Smith	L	300	\N	\N	\N	\N	\N	1998-02-27	\N	6'2	\N	L	214	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6657	6657	jamie-drysdale
5386	wyatt-newpower	Wyatt Newpower	D	319	\N	\N	\N	\N	\N	1997-12-09	\N	6.04	\N	R	210	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8584	8584	jamie-drysdale
5360	kyle-mcdonald	Kyle Mcdonald	R	321	\N	\N	\N	\N	\N	2002-02-05	\N	6'5	\N	R	209	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9964	9964	jamie-drysdale
5382	noah-laaouan	Noah Laaouan	D	315	\N	\N	\N	\N	\N	2001-03-07	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9215	9215	jamie-drysdale
5363	montana-onyebuchi	Montana Onyebuchi	D	323	\N	\N	\N	\N	\N	2000-03-08	\N	6'3	\N	R	201	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8740	8740	jamie-drysdale
5353	jack-ricketts	Jack Ricketts	F	323	\N	\N	\N	\N	\N	1999-09-08	\N	6.01	\N	L	195	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10670	10670	jamie-drysdale
5370	brody-lamb	Brody Lamb	F	305	\N	\N	\N	\N	\N	2003-08-30	\N	6'1	\N	R	179	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10979	10979	jamie-drysdale
5372	chase-stillman	Chase Stillman	R	295	\N	\N	\N	\N	\N	2003-03-19	\N	6'1	\N	R	185	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8749	8749	jamie-drysdale
5375	ivan-ryabkin	Ivan Ryabkin	C	300	\N	\N	\N	\N	\N	2007-04-25	\N	5'11	\N	L	185	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10882	10882	jamie-drysdale
5502	colin-felix	Colin Felix	D	314	\N	\N	\N	\N	\N	1999-01-07	\N	6.00	\N	R	202	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9148	9148	jamie-drysdale
5500	chase-yoder	Chase Yoder	C	311	\N	\N	\N	\N	\N	2002-05-28	\N	5.11	\N	L	201	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10910	10910	jamie-drysdale
5516	mark-liwiski	Mark Liwiski	F	308	\N	\N	\N	\N	\N	2001-08-08	\N	6.01	\N	L	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9472	9472	jamie-drysdale
5522	tim-rego	Tim Rego	D	313	\N	\N	\N	\N	\N	2000-10-31	\N	6.00	\N	L	187	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10616	10616	jamie-drysdale
5525	zakary-karpa	Zakary Karpa	F	305	\N	\N	\N	\N	\N	2002-03-25	\N	5.11	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10786	10786	jamie-drysdale
429	liam-ohgren	Liam Ohgren	L	308	8483499	92	\N	\N	\N	2004-01-28	Stockholm, SWE	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8483499.png	L	187	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10084	10084	jamie-drysdale
5504	coulson-pitre	Coulson Pitre	R	317	\N	\N	\N	\N	\N	2004-12-13	\N	6'1	\N	R	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10270	10270	jamie-drysdale
5509	jackson-edward	Jackson Edward	D	310	\N	\N	\N	\N	\N	2004-02-27	\N	6'2	\N	L	200	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10349	10349	jamie-drysdale
5526	aidan-fulp	Aidan Fulp	D	315	\N	\N	\N	\N	\N	2000-02-29	\N	6.03	\N	R	210	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9688	9688	jamie-drysdale
5531	blake-biondi	Blake Biondi	C	300	\N	\N	\N	\N	\N	2002-04-24	\N	6.01	\N	R	198	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10511	10511	jamie-drysdale
5518	noah-powell	Noah Powell	R	310	\N	\N	\N	\N	\N	2005-02-02	\N	6'1	\N	R	201	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10976	10976	jamie-drysdale
5535	carter-berger	Carter Berger	D	310	\N	\N	\N	\N	\N	1999-09-17	\N	6.00	\N	L	201	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10374	10374	jamie-drysdale
5538	chase-dafoe	Chase Dafoe	F	316	\N	\N	\N	\N	\N	2002-02-25	\N	6.03	\N	L	187	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10975	10975	jamie-drysdale
5543	ellis-rickwood	Ellis Rickwood	F	321	\N	\N	\N	\N	\N	2002-07-02	\N	6.02	\N	R	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11083	11083	jamie-drysdale
5546	harrison-israels	Harrison Israels	C	316	\N	\N	\N	\N	\N	1999-09-01	\N	6.01	\N	L	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10761	10761	jamie-drysdale
5550	joe-dunlap	Joe Dunlap	R	309	\N	\N	\N	\N	\N	1999-11-30	\N	6.00	\N	R	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10600	10600	jamie-drysdale
5555	justin-nachbaur	Justin Nachbaur	R	307	\N	\N	\N	\N	\N	2000-03-04	\N	6.03	\N	L	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9012	9012	jamie-drysdale
5570	phip-waugh	Phip Waugh	D	305	\N	\N	\N	\N	\N	2000-01-10	\N	6.04	\N	L	220	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10023	10023	jamie-drysdale
5539	cole-knuble	Cole Knuble	C	310	\N	\N	\N	\N	\N	2004-07-01	\N	5'10	\N	R	184	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11009	11009	jamie-drysdale
5541	easton-cowan	Easton Cowan	L	322	\N	\N	\N	\N	\N	2005-05-20	\N	6'0	\N	L	190	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10929	10929	jamie-drysdale
5571	reilly-webb	Reilly Webb	D	307	\N	\N	\N	\N	\N	1999-05-04	\N	6.04	\N	R	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10956	10956	jamie-drysdale
5562	matt-dimarsico	Matt Dimarsico	L	303	\N	\N	\N	\N	\N	2004-01-07	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11022	11022	jamie-drysdale
5573	riley-mckay	Riley Mckay	F	306	\N	\N	\N	\N	\N	1999-03-07	\N	6.00	\N	L	203	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8421	8421	jamie-drysdale
5579	tyson-empey	Tyson Empey	L	311	\N	\N	\N	\N	\N	1995-06-29	\N	6.02	\N	L	193	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8809	8809	jamie-drysdale
5488	vincent-arseneau	Vincent Arseneau	L	309	\N	\N	\N	\N	\N	0000-00-00	\N	6.02	\N	L	231	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4830	4830	jamie-drysdale
5561	matt-copponi	Matt Copponi	C	296	\N	\N	\N	\N	\N	2003-06-04	\N	5'11	\N	R	174	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10624	10624	jamie-drysdale
5566	nathan-bastian	Nathan Bastian	R	321	\N	\N	\N	\N	\N	1997-12-06	\N	6'4	\N	R	217	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6851	6851	jamie-drysdale
5569	patrick-thomas	Patrick Thomas	L	307	\N	\N	\N	\N	\N	2004-08-21	\N	6'0	\N	L	172	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10153	10153	jamie-drysdale
5581	artur-cholach	Artur Cholach	D	306	\N	\N	\N	\N	\N	2003-06-06	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9277	9277	jamie-drysdale
5490	will-zmolek	Will Zmolek	D	308	\N	\N	\N	\N	\N	1999-04-17	\N	6.03	\N	L	194	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9619	9619	jamie-drysdale
5491	zach-uens	Zach Uens	D	302	\N	\N	\N	\N	\N	2001-05-13	\N	6.01	\N	L	181	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9029	9029	jamie-drysdale
5575	roman-schmidt	Roman Schmidt	D	308	\N	\N	\N	\N	\N	2003-02-27	\N	6'5	\N	R	225	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9749	9749	jamie-drysdale
5477	lucas-johansen	Lucas Johansen	D	306	\N	\N	\N	\N	\N	1997-11-16	\N	6.02	\N	L	182	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6787	6787	jamie-drysdale
5478	luke-mittelstadt	Luke Mittelstadt	D	309	\N	\N	\N	\N	\N	2003-01-22	\N	5'11	\N	L	178	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10978	10978	jamie-drysdale
5495	ben-king	Ben King	C	322	\N	\N	\N	\N	\N	2002-05-15	\N	6.03	\N	R	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9188	9188	jamie-drysdale
5481	otto-salin	Otto Salin	D	313	\N	\N	\N	\N	\N	2004-03-07	\N	5'11	\N	R	187	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10567	10567	jamie-drysdale
4871	ryan-ufko	Ryan Ufko	D	312	\N	\N	\N	\N	\N	2003-05-07	\N	6'0	\N	R	174	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10078	10078	jamie-drysdale
5484	shane-bowers	Shane Bowers	F	318	\N	\N	\N	\N	\N	1999-07-30	\N	6'2	\N	L	186	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7591	7591	jamie-drysdale
5486	tyler-kopff	Tyler Kopff	L	315	\N	\N	\N	\N	\N	2003-04-22	\N	6'3	\N	L	216	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10544	10544	jamie-drysdale
5607	matt-basgall	Matt Basgall	D	317	\N	\N	\N	\N	\N	2002-08-16	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11037	11037	jamie-drysdale
5614	nolan-moyle	Nolan Moyle	R	304	\N	\N	\N	\N	\N	1999-04-13	\N	6.02	\N	R	198	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10932	10932	jamie-drysdale
5616	reilly-connors	Reilly Connors	C	303	\N	\N	\N	\N	\N	2000-03-17	\N	6.01	\N	R	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10661	10661	jamie-drysdale
5622	t-j-hughes	T.j. Hughes	C	303	\N	\N	\N	\N	\N	2001-11-09	\N	6.00	\N	R	183	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11073	11073	jamie-drysdale
5628	william-dufour	William Dufour	L	304	\N	\N	\N	\N	\N	2002-01-28	\N	6.03	\N	R	212	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9440	9440	jamie-drysdale
5641	carson-golder	Carson Golder	R	310	\N	\N	\N	\N	\N	2002-10-29	\N	6.02	\N	L	203	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9730	9730	jamie-drysdale
5633	aidan-hreschuk	Aidan Hreschuk	D	321	\N	\N	\N	\N	\N	2003-02-19	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10906	10906	jamie-drysdale
5620	sheldon-rempal	Sheldon Rempal	R	307	\N	\N	\N	\N	\N	1995-08-07	\N	5'11	\N	R	173	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7285	7285	jamie-drysdale
5645	chris-ortiz	Chris Ortiz	D	305	\N	\N	\N	\N	\N	2001-01-17	\N	5.10	\N	L	180	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8789	8789	jamie-drysdale
5626	viggo-gustafsson	Viggo Gustafsson	D	312	\N	\N	\N	\N	\N	2006-09-11	\N	6'3	\N	L	196	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11024	11024	jamie-drysdale
5648	connor-mayer	Connor Mayer	D	307	\N	\N	\N	\N	\N	1999-06-13	\N	5.11	\N	L	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10255	10255	jamie-drysdale
5631	zac-funk	Zac Funk	L	307	\N	\N	\N	\N	\N	2003-07-20	\N	6'0	\N	L	210	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10187	10187	jamie-drysdale
5654	drew-elliott	Drew Elliott	L	317	\N	\N	\N	\N	\N	2003-04-04	\N	5.10	\N	L	196	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9201	9201	jamie-drysdale
5637	blake-montgomery	Blake Montgomery	L	297	\N	\N	\N	\N	\N	2005-05-04	\N	6'4	\N	L	178	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11087	11087	jamie-drysdale
5639	brendan-smith	Brendan Smith	D	301	\N	\N	\N	\N	\N	1989-02-08	\N	6'2	\N	L	200	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=3750	3750	jamie-drysdale
5652	derek-daschke	Derek Daschke	D	295	\N	\N	\N	\N	\N	1998-01-06	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10289	10289	jamie-drysdale
5667	josh-nadeau	Josh Nadeau	F	309	\N	\N	\N	\N	\N	2003-10-22	\N	5.08	\N	R	165	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11005	11005	jamie-drysdale
5670	liam-valente	Liam Valente	C	315	\N	\N	\N	\N	\N	2003-05-23	\N	6.00	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11056	11056	jamie-drysdale
5650	david-lewandowski	David Lewandowski	F	296	\N	\N	\N	\N	\N	2007-02-20	\N	6'1	\N	L	177	\N	DEU	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11097	11097	jamie-drysdale
5686	reece-vitelli	Reece Vitelli	R	311	\N	\N	\N	\N	\N	2001-07-05	\N	5.11	\N	R	180	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9211	9211	jamie-drysdale
5656	isak-walther	Isak Walther	R	312	\N	\N	\N	\N	\N	2001-08-02	\N	6'6	\N	L	204	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10831	10831	jamie-drysdale
5658	jack-berglund	Jack Berglund	C	310	\N	\N	\N	\N	\N	2006-04-10	\N	6'3	\N	L	209	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11066	11066	jamie-drysdale
5662	jayden-grubbe	Jayden Grubbe	C	295	\N	\N	\N	\N	\N	2003-01-12	\N	6'3	\N	R	201	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9936	9936	jamie-drysdale
5664	josh-davies	Josh Davies	L	312	\N	\N	\N	\N	\N	2004-03-24	\N	5'9	\N	L	197	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9664	9664	jamie-drysdale
5688	robby-drazner	Robby Drazner	D	295	\N	\N	\N	\N	\N	2000-02-13	\N	6.01	\N	R	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10927	10927	jamie-drysdale
5671	ludwig-persson	Ludwig Persson	R	307	\N	\N	\N	\N	\N	2003-10-08	\N	6'0	\N	L	185	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9705	9705	jamie-drysdale
5693	sawyer-boulton	Sawyer Boulton	F	310	\N	\N	\N	\N	\N	2004-07-12	\N	6.00	\N	R	209	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10300	10300	jamie-drysdale
5682	neil-shea	Neil Shea	F	303	\N	\N	\N	\N	\N	1999-07-29	\N	5.11	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9613	9613	jamie-drysdale
5678	maxim-strbak	Maxim Strbak	D	315	\N	\N	\N	\N	\N	2005-04-13	\N	6'2	\N	R	196	\N	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11038	11038	jamie-drysdale
5584	chris-harpur	Chris Harpur	D	320	\N	\N	\N	\N	\N	1996-09-13	\N	6.03	\N	L	201	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9744	9744	jamie-drysdale
5683	noah-steen	Noah Steen	L	320	\N	\N	\N	\N	\N	2004-08-16	\N	6'1	\N	L	187	\N	NOR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11025	11025	jamie-drysdale
5595	jackson-kunz	Jackson Kunz	C	295	\N	\N	\N	\N	\N	2002-08-13	\N	6.03	\N	L	227	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10524	10524	jamie-drysdale
5598	jarod-crespo	Jarod Crespo	D	318	\N	\N	\N	\N	\N	2002-04-30	\N	6.00	\N	R	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11079	11079	jamie-drysdale
5604	kyle-jackson	Kyle Jackson	F	305	\N	\N	\N	\N	\N	2002-10-17	\N	6.02	\N	L	192	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9850	9850	jamie-drysdale
5602	kaden-bohlsen	Kaden Bohlsen	F	307	\N	\N	\N	\N	\N	2001-01-10	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10558	10558	jamie-drysdale
5586	connor-punnett	Connor Punnett	D	321	\N	\N	\N	\N	\N	2003-06-16	\N	6'1	\N	L	203	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10449	10449	jamie-drysdale
5583	charlie-wright	Charlie Wright	D	302	\N	\N	\N	\N	\N	2003-10-22	\N	6.01	\N	L	179	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10385	10385	jamie-drysdale
5167	scott-morrow	Scott Morrow	D	305	\N	\N	\N	\N	\N	2002-11-01	\N	6'2	\N	R	210	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10465	10465	jamie-drysdale
5593	guillaume-brisebois	Guillaume Brisebois	D	295	\N	\N	\N	\N	\N	1997-07-21	\N	6'2	\N	L	175	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6901	6901	jamie-drysdale
5600	jiri-felcman	Jiri Felcman	F	316	\N	\N	\N	\N	\N	2005-04-17	\N	6'4	\N	L	198	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10059	10059	jamie-drysdale
5726	colin-swoyer	Colin Swoyer	D	301	\N	\N	\N	\N	\N	1998-03-31	\N	6.00	\N	R	192	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9069	9069	jamie-drysdale
5728	danny-katic	Danny Katic	L	297	\N	\N	\N	\N	\N	2000-08-04	\N	6.05	\N	L	220	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10461	10461	jamie-drysdale
5731	deni-goure	Deni Goure	C	300	\N	\N	\N	\N	\N	2003-07-15	\N	5.11	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10309	10309	jamie-drysdale
5741	garrett-pyke	Garrett Pyke	D	307	\N	\N	\N	\N	\N	1999-08-01	\N	6.01	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10114	10114	jamie-drysdale
5750	jacob-dion	Jacob Dion	D	309	\N	\N	\N	\N	\N	2001-11-01	\N	5.09	\N	L	177	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10782	10782	jamie-drysdale
5752	jake-murray	Jake Murray	D	316	\N	\N	\N	\N	\N	2002-04-11	\N	6.03	\N	L	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9965	9965	jamie-drysdale
5754	jayden-lee	Jayden Lee	D	295	\N	\N	\N	\N	\N	2001-01-10	\N	5.09	\N	R	155	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10339	10339	jamie-drysdale
5755	jett-jones	Jett Jones	F	319	\N	\N	\N	\N	\N	2002-08-27	\N	6.03	\N	L	221	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9950	9950	jamie-drysdale
5736	emil-hemming	Emil Hemming	F	321	\N	\N	\N	\N	\N	2006-06-27	\N	6'2	\N	R	211	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10648	10648	jamie-drysdale
5738	ethan-czata	Ethan Czata	C	320	\N	\N	\N	\N	\N	2007-05-29	\N	6'1	\N	L	179	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11060	11060	jamie-drysdale
5762	kyle-walker	Kyle Walker	D	298	\N	\N	\N	\N	\N	2000-07-09	\N	6.02	\N	L	203	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11043	11043	jamie-drysdale
5759	kent-anderson	Kent Anderson	D	298	\N	\N	\N	\N	\N	2003-11-03	\N	6.00	\N	L	210	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11082	11082	jamie-drysdale
5748	ilya-solovyov	Ilya Solovyov	D	303	\N	\N	\N	\N	\N	2000-07-20	\N	6'3	\N	L	208	\N	BLR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8784	8784	jamie-drysdale
5766	lukas-sillinger	Lukas Sillinger	L	308	\N	\N	\N	\N	\N	2000-09-14	\N	5.10	\N	L	170	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10943	10943	jamie-drysdale
5757	josh-eernisse	Josh Eernisse	R	301	\N	\N	\N	\N	\N	2001-12-31	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11072	11072	jamie-drysdale
5771	max-andreev	Max Andreev	L	314	\N	\N	\N	\N	\N	1998-10-22	\N	6.00	\N	L	183	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9682	9682	jamie-drysdale
5773	nathan-brown	Nathan Brown	C	297	\N	\N	\N	\N	\N	2006-02-27	\N	6.00	\N	L	163	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11077	11077	jamie-drysdale
5774	owen-lindmark	Owen Lindmark	C	317	\N	\N	\N	\N	\N	2001-05-17	\N	6.00	\N	R	192	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10502	10502	jamie-drysdale
5776	riley-mccourt	Riley Mccourt	D	297	\N	\N	\N	\N	\N	2000-06-26	\N	5.11	\N	L	194	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8595	8595	jamie-drysdale
5780	ryan-mccleary	Ryan Mccleary	D	322	\N	\N	\N	\N	\N	2003-09-09	\N	6.03	\N	L	182	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9883	9883	jamie-drysdale
5781	ryan-mcguire	Ryan Mcguire	F	308	\N	\N	\N	\N	\N	2002-07-27	\N	6.02	\N	R	183	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10916	10916	jamie-drysdale
5785	samuel-mayer	Samuel Mayer	D	306	\N	\N	\N	\N	\N	2003-04-15	\N	6.03	\N	L	210	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9261	9261	jamie-drysdale
5792	tristan-sarsland	Tristan Sarsland	D	318	\N	\N	\N	\N	\N	2004-02-25	\N	6.01	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11007	11007	jamie-drysdale
5783	sam-sedley	Sam Sedley	D	297	\N	\N	\N	\N	\N	2003-06-08	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10294	10294	jamie-drysdale
5794	tyler-weiss	Tyler Weiss	L	300	\N	\N	\N	\N	\N	2000-01-03	\N	5.10	\N	L	158	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9913	9913	jamie-drysdale
5796	vincent-sevigny	Vincent Sevigny	D	310	\N	\N	\N	\N	\N	2001-04-14	\N	6.03	\N	L	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7690	7690	jamie-drysdale
5799	xavier-bernard	Xavier Bernard	D	298	\N	\N	\N	\N	\N	2000-01-06	\N	6.04	\N	L	210	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8858	8858	jamie-drysdale
5743	hayes-hundley	Hayes Hundley	D	322	\N	\N	\N	\N	\N	2005-03-22	\N	6.02	\N	R	207	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11019	11019	jamie-drysdale
5801	zach-okabe	Zach Okabe	C	295	\N	\N	\N	\N	\N	2001-01-04	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10064	10064	jamie-drysdale
5701	wyatte-wylie	Wyatte Wylie	D	309	\N	\N	\N	\N	\N	1999-11-02	\N	6.00	\N	R	192	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7849	7849	jamie-drysdale
5704	alex-gaffney	Alex Gaffney	L	307	\N	\N	\N	\N	\N	2002-06-25	\N	5.08	\N	R	177	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11001	11001	jamie-drysdale
5711	ben-dexheimer	Ben Dexheimer	D	308	\N	\N	\N	\N	\N	2002-06-21	\N	5.10	\N	R	179	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11086	11086	jamie-drysdale
5712	ben-meehan	Ben Meehan	D	310	\N	\N	\N	\N	\N	2001-04-20	\N	6.00	\N	L	188	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10549	10549	jamie-drysdale
4905	tristan-luneau	Tristan Luneau	D	317	\N	\N	\N	\N	\N	2004-01-12	\N	6'1	\N	R	211	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9194	9194	jamie-drysdale
5714	ben-zloty	Ben Zloty	D	311	\N	\N	\N	\N	\N	2002-02-24	\N	6.00	\N	L	188	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9960	9960	jamie-drysdale
5717	brendan-gorman	Brendan Gorman	F	313	\N	\N	\N	\N	\N	2003-02-17	\N	6.00	\N	R	175	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11021	11021	jamie-drysdale
5720	chad-nychuk	Chad Nychuk	D	312	\N	\N	\N	\N	\N	2001-03-06	\N	6.01	\N	L	193	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9601	9601	jamie-drysdale
5168	tuomas-uronen	Tuomas Uronen	F	306	\N	\N	\N	\N	\N	2005-03-19	\N	6'0	\N	R	198	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10280	10280	jamie-drysdale
5697	tyson-feist	Tyson Feist	D	296	\N	\N	\N	\N	\N	2001-01-14	\N	6.03	\N	R	208	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9170	9170	jamie-drysdale
5722	chongmin-lee	Chongmin Lee	F	301	\N	\N	\N	\N	\N	1999-05-10	\N	5.11	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10379	10379	jamie-drysdale
5740	frank-djurasevic	Frank Djurasevic	D	322	\N	\N	\N	\N	\N	2002-03-09	\N	6.02	\N	R	198	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11018	11018	jamie-drysdale
5373	connor-mylymok	Connor Mylymok	L	316	\N	\N	\N	\N	\N	2000-03-18	\N	6.02	\N	L	208	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10317	10317	jamie-drysdale
5696	tyler-motte	Tyler Motte	L	299	\N	\N	\N	\N	\N	1995-03-10	\N	5'10	\N	L	194	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6331	6331	jamie-drysdale
5699	vinny-borgesi	Vinny Borgesi	D	322	\N	\N	\N	\N	\N	2004-03-02	\N	5'9	\N	R	174	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10991	10991	jamie-drysdale
19	connor-murphy	Connor Murphy	D	1	8476473	5	\N	\N	\N	1993-03-26	Boston, Massachusetts, USA	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476473.png	R	212	\N	USA	\N	\N	\N
5054	gavin-bayreuther	Gavin Bayreuther	D	315	\N	\N	\N	\N	\N	1994-05-12	\N	6'2	\N	L	210	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6633	6633	jamie-drysdale
5101	kevin-rooney	Kevin Rooney	C	323	\N	\N	\N	\N	\N	1993-05-21	\N	6'2	\N	L	190	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6263	6263	jamie-drysdale
24	devon-levi	Devon Levi	G	1	8482221	27	\N	\N	\N	2001-12-27	Dollard-des-Ormeaux, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482221.png	L	192	\N	CAN	\N	\N	\N
5170	william-trudeau	William Trudeau	D	309	\N	\N	\N	\N	\N	2002-10-11	\N	6'1	\N	L	205	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9520	9520	jamie-drysdale
5126	stian-solberg	Stian Solberg	D	317	\N	\N	\N	\N	\N	2005-12-29	\N	6'2	\N	L	207	\N	NOR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10506	10506	jamie-drysdale
5459	spencer-kersten	Spencer Kersten	R	320	\N	\N	\N	\N	\N	2000-05-16	\N	5.10	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10399	10399	jamie-drysdale
30	adrian-kempe	Adrian Kempe	R	19	8477960	9	\N	\N	\N	1996-09-13	Kramfors, SWE	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477960.png	L	205	\N	SWE	\N	\N	\N
5582	brandon-holt	Brandon Holt	D	323	\N	\N	\N	\N	\N	2001-04-30	\N	5.11	\N	L	180	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11033	11033	jamie-drysdale
5255	mattias-havelid	Mattias Havelid	D	318	\N	\N	\N	\N	\N	2004-01-01	\N	5'10	\N	R	170	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10699	10699	jamie-drysdale
5280	andreas-englund	Andreas Englund	D	312	\N	\N	\N	\N	\N	1996-01-21	\N	6'4	\N	L	200	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6403	6403	jamie-drysdale
5304	jacob-macdonald	Jacob Macdonald	D	303	\N	\N	\N	\N	\N	1993-02-26	\N	6'0	\N	L	204	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6340	6340	jamie-drysdale
5510	jackson-van-de-leest	Jackson Van De Leest	D	324	\N	\N	\N	\N	\N	2001-06-15	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8778	8778	jamie-drysdale
5419	etienne-morin	Etienne Morin	D	298	\N	\N	\N	\N	\N	2005-03-09	\N	6'0	\N	L	180	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10137	10137	jamie-drysdale
5646	christopher-brown	Christopher Brown	R	314	\N	\N	\N	\N	\N	1996-02-22	\N	6.00	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7564	7564	jamie-drysdale
5689	ryan-chyzowski	Ryan Chyzowski	C	298	\N	\N	\N	\N	\N	2000-05-14	\N	6.01	\N	L	177	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7776	7776	jamie-drysdale
5217	keean-washkurak	Keean Washkurak	C	297	\N	\N	\N	\N	\N	2001-08-16	\N	5'10	\N	L	188	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8720	8720	jamie-drysdale
5544	fabian-wagner	Fabian Wagner	L	311	\N	\N	\N	\N	\N	2004-05-07	\N	5'10	\N	L	170	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10483	10483	jamie-drysdale
5718	brooklyn-kalmikov	Brooklyn Kalmikov	L	314	\N	\N	\N	\N	\N	2001-04-21	\N	6.00	\N	L	180	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9363	9363	jamie-drysdale
36	alex-turcotte	Alex Turcotte	C	19	8481532	15	\N	\N	\N	2001-02-26	Elk Grove, Illinois, USA	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481532.png	L	195	\N	USA	\N	\N	\N
5193	daniel-d-amato	Daniel D'amato	L	296	\N	\N	\N	\N	\N	2001-04-08	\N	6.01	\N	L	194	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8846	8846	jamie-drysdale
42	drew-doughty	Drew Doughty	D	19	8474563	8	\N	\N	\N	1989-12-08	London, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8474563.png	R	210	\N	CAN	\N	\N	\N
48	darcy-kuemper	Darcy Kuemper	G	19	8475311	35	\N	\N	\N	1990-05-05	Saskatoon, Saskatchewan, CAN	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475311.png	L	215	\N	CAN	\N	\N	\N
61	yakov-trenin	Yakov Trenin	C	20	8478508	13	\N	\N	\N	1997-01-13	Chelyabinsk, RUS	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478508.png	L	201	\N	RUS	\N	\N	\N
67	quinn-hughes	Quinn Hughes	D	20	8480800	43	\N	\N	\N	1999-10-14	Orlando, Florida, USA	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480800.png	L	180	\N	USA	\N	\N	\N
76	calvin-pickard	Calvin Pickard	G	20	8475717	31	\N	\N	\N	1992-04-15	Moncton, New Brunswick, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475717.png	L	206	\N	CAN	\N	\N	\N
84	phillip-danault	Phillip Danault	C	21	8476479	24	\N	\N	\N	1993-02-24	Victoriaville, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476479.png	L	200	\N	CAN	\N	\N	\N
90	nick-suzuki	Nick Suzuki	C	21	8480018	14	\N	\N	\N	1999-08-10	London, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480018.png	R	207	\N	CAN	\N	\N	\N
97	lane-hutson	Lane Hutson	D	21	8483457	48	\N	\N	\N	2004-02-14	Holland, Michigan, USA	5'9"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483457.png	L	162	\N	USA	\N	\N	\N
104	jacob-fowler	Jacob Fowler	G	21	8484170	32	\N	\N	\N	2004-11-24	Melbourne, Florida, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484170.png	L	223	\N	USA	\N	\N	\N
112	filip-forsberg	Filip Forsberg	L	22	8476887	9	\N	\N	\N	1994-08-13	Ostervala, SWE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476887.png	R	205	\N	SWE	\N	\N	\N
323	dalibor-dvorsky	Dalibor Dvorsky	F	319	8484164	54	\N	\N	\N	2005-06-15	Zvolen, SVK	6'1	https://assets.nhle.com/mugs/nhl/latest/168x168/8484164.png	L	207	\N	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10329	10329	jamie-drysdale
111	aiden-fink	Aiden Fink	R	312	8484494	18	\N	\N	\N	2004-11-24	Calgary, Alberta, CAN	5'10	https://assets.nhle.com/mugs/nhl/latest/168x168/8484494.png	R	165	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11023	11023	jamie-drysdale
14	matt-savoie	Matt Savoie	C	1	8483512	22	\N	\N	\N	2004-01-01	St. Albert, Alberta, CAN	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483512.png	R	179	\N	CAN	\N	\N	\N
10203	chris-terry	Chris Terry	F	326	\N	\N	\N	\N	\N	1989-04-07	\N	5'10	\N	L	191	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=2350	2350	jamie-drysdale
10349	alex-alexeyev	Alex Alexeyev	D	325	\N	\N	\N	\N	\N	1999-11-15	\N	6.04	\N	L	213	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7632	7632	jamie-drysdale
10440	phil-kemp	Phil Kemp	D	325	\N	\N	\N	\N	\N	1999-02-12	\N	6.03	\N	R	212	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8664	8664	jamie-drysdale
10296	chase-pietila	Chase Pietila	D	325	\N	\N	\N	\N	\N	2004-03-03	\N	6'2	\N	R	200	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10504	10504	jamie-drysdale
10540	raivis-ansons	Raivis Ansons	L	325	\N	\N	\N	\N	\N	2002-01-29	\N	6.01	\N	L	192	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9364	9364	jamie-drysdale
10591	david-breazeale	David Breazeale	D	325	\N	\N	\N	\N	\N	2000-04-22	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10634	10634	jamie-drysdale
10426	eetu-liukas	Eetu Liukas	F	326	\N	\N	\N	\N	\N	2002-09-25	\N	6'3	\N	L	203	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9954	9954	jamie-drysdale
10757	dylan-moulton	Dylan Moulton	D	311	\N	\N	\N	\N	\N	2001-04-24	\N	6.02	\N	L	203	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10966	10966	jamie-drysdale
12682	melvin-fernstrom	Melvin Fernstrom	R	325	\N	\N	\N	\N	\N	2006-02-28	\N	6'1	\N	R	185	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10959	10959	jamie-drysdale
10704	mathieu-de-st-phalle	Mathieu De St. Phalle	R	325	\N	\N	\N	\N	\N	2000-03-20	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10085	10085	jamie-drysdale
10538	nolan-renwick	Nolan Renwick	R	325	\N	\N	\N	\N	\N	2001-02-16	\N	6'3	\N	R	212	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10560	10560	jamie-drysdale
10764	jackson-jutting	Jackson Jutting	F	304	\N	\N	\N	\N	\N	2001-02-27	\N	5.11	\N	L	186	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10829	10829	jamie-drysdale
10631	daniel-laatsch	Daniel Laatsch	D	325	\N	\N	\N	\N	\N	2002-02-13	\N	6'5	\N	L	191	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10850	10850	jamie-drysdale
10773	kaleb-pearson	Kaleb Pearson	F	321	\N	\N	\N	\N	\N	2000-06-15	\N	5.11	\N	R	184	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10905	10905	jamie-drysdale
10809	zach-urdahl	Zach Urdahl	F	325	\N	\N	\N	\N	\N	2001-10-13	\N	6.01	\N	L	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10852	10852	jamie-drysdale
10710	mikhail-ilyin	Mikhail Ilyin	F	325	\N	\N	\N	\N	\N	2005-02-15	\N	6'3	\N	L	191	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11063	11063	jamie-drysdale
10848	drake-burgin	Drake Burgin	D	302	\N	\N	\N	\N	\N	2000-10-22	\N	5.11	\N	R	180	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10965	10965	jamie-drysdale
10879	lachlan-getz	Lachlan Getz	D	319	\N	\N	\N	\N	\N	2002-02-01	\N	6.03	\N	R	195	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10980	10980	jamie-drysdale
10887	mason-mccormick	Mason Mccormick	C	312	\N	\N	\N	\N	\N	2001-05-25	\N	6.03	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10998	10998	jamie-drysdale
10894	nick-andrews	Nick Andrews	D	304	\N	\N	\N	\N	\N	2001-07-06	\N	5.10	\N	L	193	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10971	10971	jamie-drysdale
15	evan-bouchard	Evan Bouchard	D	1	8480803	2	\N	\N	\N	1999-10-20	Oakville, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480803.png	R	192	\N	CAN	\N	\N	\N
10827	brent-johnson	Brent Johnson	D	325	\N	\N	\N	\N	\N	1977-03-12	\N	6' 3	\N	L	199	\N	Uni	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10619	10619	jamie-drysdale
20	ryan-shea	Ryan Shea	D	1	8478854	6	\N	\N	\N	1997-02-11	Milton, Massachusetts, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478854.png	L	200	\N	USA	\N	\N	\N
10683	daniel-russell	Daniel Russell	F	325	\N	\N	\N	\N	\N	2001-11-16	\N	5.09	\N	L	153	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11044	11044	jamie-drysdale
10226	matt-dumba	Matt Dumba	D	325	\N	\N	\N	\N	\N	1994-07-25	\N	6.00	\N	R	191	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4933	4933	jamie-drysdale
10904	ryan-miller	Ryan Miller	F	325	\N	\N	\N	\N	\N	2007-05-03	\N	6'0	\N	L	177	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11062	11062	jamie-drysdale
10273	cam-thiesing	Cam Thiesing	F	326	\N	\N	\N	\N	\N	2001-03-26	\N	6.00	\N	R	189	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10388	10388	jamie-drysdale
9883	adam-beckman	Adam Beckman	L	326	\N	\N	\N	\N	\N	2001-05-10	\N	6'2	\N	L	192	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8549	8549	jamie-drysdale
9920	aidan-mcdonough	Aidan Mcdonough	L	325	\N	\N	\N	\N	\N	1999-11-06	\N	6'3	\N	L	190	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9984	9984	jamie-drysdale
9946	ville-koivunen	Ville Koivunen	L	325	\N	\N	\N	\N	\N	2003-06-13	\N	6'0	\N	L	184	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9649	9649	jamie-drysdale
9954	avery-hayes	Avery Hayes	R	325	\N	\N	\N	\N	\N	2002-10-10	\N	5'10	\N	R	180	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9816	9816	jamie-drysdale
10016	rutger-mcgroarty	Rutger Mcgroarty	L	325	\N	\N	\N	\N	\N	2004-03-30	\N	6'1	\N	L	212	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10472	10472	jamie-drysdale
10032	marshall-warren	Marshall Warren	D	326	\N	\N	\N	\N	\N	2001-04-20	\N	5'11	\N	L	195	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10152	10152	jamie-drysdale
10069	joey-larson	Joey Larson	F	326	\N	\N	\N	\N	\N	2001-03-27	\N	6'1	\N	R	194	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10562	10562	jamie-drysdale
4830	nikita-alexandrov	Nikita Alexandrov	F	313	\N	\N	\N	\N	\N	2000-09-16	\N	6'1	\N	L	189	\N	DEU	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8718	8718	jamie-drysdale
23	tristan-jarry	Tristan Jarry	G	1	8477465	35	\N	\N	\N	1995-04-29	Surrey, British Columbia, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477465.png	L	201	\N	CAN	\N	\N	\N
10131	daylan-kuefler	Daylan Kuefler	F	326	\N	\N	\N	\N	\N	2002-02-10	\N	6'2	\N	L	196	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9442	9442	jamie-drysdale
41	brandt-clarke	Brandt Clarke	D	19	8482730	92	\N	\N	\N	2003-02-09	Nepean, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482730.png	R	200	\N	CAN	\N	\N	\N
43	brian-dumoulin	Brian Dumoulin	D	19	8475208	2	\N	\N	\N	1991-09-06	Biddeford, Maine, USA	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475208.png	L	215	\N	USA	\N	\N	\N
49	matt-boldy	Matt Boldy	L	20	8481557	12	\N	\N	\N	2001-04-05	Milford, Massachusetts, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481557.png	L	201	\N	USA	\N	\N	\N
51	blake-coleman	Blake Coleman	L	20	8476399	20	\N	\N	\N	1991-11-28	Plano, Texas, USA	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476399.png	L	199	\N	USA	\N	\N	\N
56	ryan-hartman	Ryan Hartman	R	20	8477451	38	\N	\N	\N	1994-09-20	Hilton Head Island, South Carolina, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477451.png	R	197	\N	USA	\N	\N	\N
60	nico-sturm	Nico Sturm	C	20	8481477	78	\N	\N	\N	1995-05-03	Augsburg, DEU	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481477.png	L	209	\N	DEU	\N	\N	\N
65	brock-faber	Brock Faber	D	20	8482122	7	\N	\N	\N	2002-08-22	Maple Grove, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482122.png	R	200	\N	USA	\N	\N	\N
71	olli-maatta	Olli Maatta	D	20	8476874	3	\N	\N	\N	1994-08-22	Jyväskylä, FIN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476874.png	L	207	\N	FIN	\N	\N	\N
73	jared-spurgeon	Jared Spurgeon	D	20	8474716	46	\N	\N	\N	1989-11-29	Edmonton, Alberta, CAN	5'9"	https://assets.nhle.com/mugs/nhl/latest/168x168/8474716.png	R	166	\N	CAN	\N	\N	\N
79	josh-anderson	Josh Anderson	R	21	8476981	17	\N	\N	\N	1994-05-07	Burlington, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476981.png	R	226	\N	CAN	\N	\N	\N
81	zachary-bolduc	Zachary Bolduc	R	21	8482737	76	\N	\N	\N	2003-02-24	Trois-Rivières, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482737.png	L	187	\N	CAN	\N	\N	\N
87	oliver-kapanen	Oliver Kapanen	C	21	8482775	91	\N	\N	\N	2003-07-29	Timra, SWE	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482775.png	R	194	\N	SWE	\N	\N	\N
91	alexandre-texier	Alexandre Texier	L	21	8480074	85	\N	\N	\N	1999-09-13	Saint-Martin-d'Hères, FRA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480074.png	L	196	\N	FRA	\N	\N	\N
98	mike-matheson	Mike Matheson	D	21	8476875	8	\N	\N	\N	1994-02-27	Pointe-Claire, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476875.png	L	196	\N	CAN	\N	\N	\N
102	arber-xhekaj	Arber Xhekaj	D	21	8482964	72	\N	\N	\N	2001-01-30	Hamilton, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482964.png	L	240	\N	CAN	\N	\N	\N
107	ross-colton	Ross Colton	C	22	8479525	\N	\N	\N	\N	1996-09-11	Robbinsville, New Jersey, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479525.png	L	194	\N	USA	\N	\N	\N
110	luke-evangelista	Luke Evangelista	R	22	8482146	77	\N	\N	\N	2002-02-21	Toronto, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482146.png	R	183	\N	CAN	\N	\N	\N
396	michael-carcone	Michael Carcone	L	34	8479619	53	\N	\N	\N	1996-05-19	Ajax, Ontario, CAN	5'9"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479619.png	L	182	\N	CAN	\N	\N	\N
26	quinton-byfield	Quinton Byfield	R	19	8482124	55	\N	\N	\N	2002-08-19	Newmarket, Ontario, CAN	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482124.png	L	230	\N	CAN	\N	\N	\N
125	brady-skjei	Brady Skjei	D	22	8476869	76	\N	\N	\N	1994-03-26	Lakeville, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476869.png	L	210	\N	USA	\N	\N	\N
129	nick-bjugstad	Nick Bjugstad	C	23	8475760	72	\N	\N	\N	1992-07-17	Minneapolis, Minnesota, USA	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475760.png	R	210	\N	USA	\N	\N	\N
135	nico-hischier	Nico Hischier	C	23	8480002	13	\N	\N	\N	1999-01-04	Naters, CHE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480002.png	L	200	\N	CHE	\N	\N	\N
137	anthony-mantha	Anthony Mantha	R	23	8477511	\N	\N	\N	\N	1994-09-16	Longueuil, Quebec, CAN	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477511.png	L	240	\N	CAN	\N	\N	\N
143	brenden-dillon	Brenden Dillon	D	23	8475455	5	\N	\N	\N	1990-11-13	New Westminster, British Columbia, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475455.png	L	225	\N	CAN	\N	\N	\N
149	jake-allen	Jake Allen	G	23	8474596	34	\N	\N	\N	1990-08-07	Fredericton, New Brunswick, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8474596.png	L	197	\N	CAN	\N	\N	\N
151	mathew-barzal	Mathew Barzal	C	24	8478445	13	\N	\N	\N	1997-05-26	Coquitlam, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478445.png	R	186	\N	CAN	\N	\N	\N
157	matias-maccelli	Matias Maccelli	L	24	8481711	\N	\N	\N	\N	2000-10-14	Turku, FIN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481711.png	L	187	\N	FIN	\N	\N	\N
159	jean-gabriel-pageau	Jean-Gabriel Pageau	C	24	8476419	44	\N	\N	\N	1992-11-11	Ottawa, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476419.png	R	180	\N	CAN	\N	\N	\N
165	scott-mayfield	Scott Mayfield	D	24	8476429	24	\N	\N	\N	1992-10-14	St. Louis, Missouri, USA	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476429.png	R	215	\N	USA	\N	\N	\N
169	matthew-schaefer	Matthew Schaefer	D	24	8485366	48	\N	\N	\N	2007-09-05	Hamilton, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8485366.png	L	186	\N	CAN	\N	\N	\N
171	vitek-vanecek	Vitek Vanecek	G	24	8477970	\N	\N	\N	\N	1996-01-09	Havlickuv Brod, CZE	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477970.png	L	184	\N	CZE	\N	\N	\N
178	noah-laba	Noah Laba	C	25	8483690	42	\N	\N	\N	2003-08-04	Northville, Michigan, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483690.png	R	214	\N	USA	\N	\N	\N
182	taylor-raddysh	Taylor Raddysh	R	25	8479390	14	\N	\N	\N	1998-02-18	Caledon, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479390.png	R	201	\N	CAN	\N	\N	\N
186	mika-zibanejad	Mika Zibanejad	C	25	8476459	93	\N	\N	\N	1993-04-18	Stockholm, SWE	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476459.png	R	208	\N	SWE	\N	\N	\N
194	braden-schneider	Braden Schneider	D	25	8482073	4	\N	\N	\N	2001-09-20	Prince Albert, Saskatchewan, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482073.png	R	206	\N	CAN	\N	\N	\N
33	trevor-moore	Trevor Moore	L	19	8479675	12	\N	\N	\N	1995-03-31	Thousand Oaks, California, USA	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479675.png	L	195	\N	USA	\N	\N	\N
405	ben-mccartney	Ben Mccartney	F	323	8481827	62	\N	\N	\N	2001-07-13	Portage la Prairie, Manitoba, CAN	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8481827.png	L	182	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8734	8734	jamie-drysdale
35	corey-perry	Corey Perry	R	19	8470621	\N	\N	\N	\N	1985-05-16	Peterborough, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8470621.png	R	210	\N	CAN	\N	\N	\N
225	leevi-merilinen	Leevi Meriläinen	G	26	8482447	1	\N	\N	\N	2002-08-13	Oulu, FIN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482447.png	L	196	\N	FIN	\N	\N	\N
4969	phillip-di-giuseppe	Phillip Di Giuseppe	L	311	\N	\N	\N	\N	\N	1993-10-09	\N	6'0	\N	L	193	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5469	5469	jamie-drysdale
233	tyson-foerster	Tyson Foerster	R	27	8482159	71	\N	\N	\N	2002-01-18	Alliston, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482159.png	R	215	\N	CAN	\N	\N	\N
122	roman-josi	Roman Josi	D	22	8474600	59	\N	\N	\N	1990-06-01	Bern, CHE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8474600.png	L	201	\N	CHE	\N	\N	\N
243	simon-benoit	Simon Benoit	D	27	8481122	\N	\N	\N	\N	1998-09-19	Laval, Quebec, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481122.png	L	210	\N	CAN	\N	\N	\N
253	carson-bjarnason	Carson Bjarnason	G	27	8484147	64	\N	\N	\N	2005-06-30	Brandon, Manitoba, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484147.png	L	186	\N	CAN	\N	\N	\N
256	joseph-woll	Joseph Woll	G	27	8479361	\N	\N	\N	\N	1998-07-12	Dardenne Prairie, Missouri, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479361.png	L	212	\N	USA	\N	\N	\N
260	connor-dewar	Connor Dewar	C	28	8480980	19	\N	\N	\N	1999-06-26	The Pas, Manitoba, CAN	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480980.png	L	187	\N	CAN	\N	\N	\N
266	tommy-novak	Tommy Novak	C	28	8478438	18	\N	\N	\N	1997-04-28	St. Paul, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478438.png	L	190	\N	USA	\N	\N	\N
268	nicholas-robertson	Nicholas Robertson	L	28	8481582	\N	\N	\N	\N	2001-09-11	Pasadena, California, USA	5'9"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481582.png	L	180	\N	USA	\N	\N	\N
275	kaedan-korczak	Kaedan Korczak	D	28	8481527	\N	\N	\N	\N	2001-01-29	Yorkton, Saskatchewan, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481527.png	R	206	\N	CAN	\N	\N	\N
278	sergei-murashov	Sergei Murashov	G	28	8483703	1	\N	\N	\N	2004-04-01	Yaroslavl, RUS	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483703.png	R	185	\N	RUS	\N	\N	\N
283	barclay-goodrow	Barclay Goodrow	C	29	8476624	23	\N	\N	\N	1993-02-26	Toronto, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476624.png	L	210	\N	CAN	\N	\N	\N
292	sam-dickinson	Sam Dickinson	D	29	8484806	6	\N	\N	\N	2006-06-07	Toronto, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484806.png	L	200	\N	CAN	\N	\N	\N
294	darnell-nurse	Darnell Nurse	D	29	8477498	25	\N	\N	\N	1995-02-04	Hamilton, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477498.png	L	215	\N	CAN	\N	\N	\N
300	matty-beniers	Matty Beniers	C	30	8482665	10	\N	\N	\N	2002-11-05	Hingham, Massachusetts, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482665.png	L	181	\N	USA	\N	\N	\N
302	jordan-eberle	Jordan Eberle	R	30	8474586	7	\N	\N	\N	1990-05-15	Regina, Saskatchewan, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8474586.png	R	180	\N	CAN	\N	\N	\N
308	mackie-samoskevich	Mackie Samoskevich	R	30	8482713	11	\N	\N	\N	2002-11-15	Newtown, Connecticut, USA	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482713.png	R	180	\N	USA	\N	\N	\N
311	shane-wright	Shane Wright	C	30	8483524	51	\N	\N	\N	2004-01-05	Burlington, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483524.png	R	192	\N	CAN	\N	\N	\N
316	ryan-lindgren	Ryan Lindgren	D	30	8479324	55	\N	\N	\N	1998-02-11	Burnsville, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479324.png	L	194	\N	USA	\N	\N	\N
320	philipp-grubauer	Philipp Grubauer	G	30	8475831	31	\N	\N	\N	1991-11-25	Rosenheim, DEU	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475831.png	L	188	\N	DEU	\N	\N	\N
325	dylan-holloway	Dylan Holloway	L	31	8482077	81	\N	\N	\N	2001-09-23	Calgary, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482077.png	L	207	\N	CAN	\N	\N	\N
331	oskar-sundqvist	Oskar Sundqvist	C	31	8476897	70	\N	\N	\N	1994-03-23	Boden, SWE	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476897.png	R	210	\N	SWE	\N	\N	\N
335	nathan-walker	Nathan Walker	L	31	8477573	26	\N	\N	\N	1994-02-07	Cardiff, GBR	5'9"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477573.png	L	191	\N	GBR	\N	\N	\N
341	tyler-tucker	Tyler Tucker	D	31	8481006	75	\N	\N	\N	2000-03-01	Thunder Bay, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481006.png	L	204	\N	CAN	\N	\N	\N
343	joel-hofer	Joel Hofer	G	31	8480981	30	\N	\N	\N	2000-07-30	Winnipeg, Manitoba, CAN	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480981.png	L	193	\N	CAN	\N	\N	\N
348	yanni-gourde	Yanni Gourde	C	32	8476826	37	\N	\N	\N	1991-12-15	Saint-Narcisse, Quebec, CAN	5'9"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476826.png	L	173	\N	CAN	\N	\N	\N
350	brandon-hagel	Brandon Hagel	L	32	8479542	38	\N	\N	\N	1998-08-27	Saskatoon, Saskatchewan, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479542.png	L	186	\N	CAN	\N	\N	\N
400	barrett-hayton	Barrett Hayton	C	34	8480849	27	\N	\N	\N	2000-06-09	Peterborough, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480849.png	L	200	\N	CAN	\N	\N	\N
404	jack-mcbain	Jack McBain	C	34	8480855	22	\N	\N	\N	2000-01-06	Toronto, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480855.png	L	219	\N	CAN	\N	\N	\N
409	brandon-tanev	Brandon Tanev	L	34	8479293	13	\N	\N	\N	1991-12-31	Toronto, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479293.png	L	189	\N	CAN	\N	\N	\N
411	kailer-yamamoto	Kailer Yamamoto	R	34	8479977	56	\N	\N	\N	1998-09-29	Spokane, Washington, USA	5'9"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479977.png	R	178	\N	USA	\N	\N	\N
417	mikhail-sergachev	Mikhail Sergachev	D	34	8479410	98	\N	\N	\N	1998-06-25	Nizhnekamsk, RUS	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479410.png	L	212	\N	RUS	\N	\N	\N
420	jaxson-stauber	Jaxson Stauber	G	34	8483530	33	\N	\N	\N	1999-04-27	Wayzata, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483530.png	L	174	\N	USA	\N	\N	\N
271	declan-carlile	Declan Carlile	D	320	8483398	\N	\N	\N	\N	2000-05-18	Hartland, Michigan, USA	6'3	https://assets.nhle.com/mugs/nhl/latest/168x168/8483398.png	L	190	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9034	9034	jamie-drysdale
215	fabian-zetterlund	Fabian Zetterlund	L	26	8480188	20	\N	\N	\N	1999-08-25	Karlstad, SWE	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480188.png	R	208	\N	SWE	\N	\N	\N
219	nikolas-matinpalo	Nikolas Matinpalo	D	26	8484321	33	\N	\N	\N	1998-10-05	Espoo, FIN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484321.png	R	213	\N	FIN	\N	\N	\N
181	gabe-perreault	Gabe Perreault	F	305	8484210	94	\N	\N	\N	2005-05-07	Sherbrooke, Quebec, CAN	5'11	https://assets.nhle.com/mugs/nhl/latest/168x168/8484210.png	L	180	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10737	10737	jamie-drysdale
437	jamie-oleksiak	Jamie Oleksiak	D	35	8476467	\N	\N	\N	\N	1992-12-21	Toronto, Ontario, CAN	6'7"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476467.png	L	252	\N	CAN	\N	\N	\N
538	tyson-hinds	Tyson Hinds	D	317	8482731	60	\N	\N	\N	2003-03-12	Gatineau, Quebec, CAN	6'3	https://assets.nhle.com/mugs/nhl/latest/168x168/8482731.png	L	201	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9193	9193	jamie-drysdale
4993	garrett-pilon	Garrett Pilon	C	297	\N	\N	\N	\N	\N	1998-04-13	\N	5'11	\N	R	209	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6715	6715	jamie-drysdale
444	ivan-barbashev	Ivan Barbashev	L	36	8477964	49	\N	\N	\N	1995-12-14	Moscow, RUS	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477964.png	L	203	\N	RUS	\N	\N	\N
453	william-karlsson	William Karlsson	C	36	8476448	71	\N	\N	\N	1993-01-08	Marsta, SWE	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476448.png	L	190	\N	SWE	\N	\N	\N
5116	ethan-edwards	Ethan Edwards	D	324	\N	\N	\N	\N	\N	2002-06-06	\N	5'10	\N	L	176	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10529	10529	jamie-drysdale
459	mark-stone	Mark Stone	R	36	8475913	61	\N	\N	\N	1992-05-13	Winnipeg, Manitoba, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475913.png	R	210	\N	CAN	\N	\N	\N
352	pontus-holmberg	Pontus Holmberg	R	32	8480995	29	\N	\N	\N	1999-03-09	Vasteras, SWE	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480995.png	L	201	\N	SWE	\N	\N	\N
360	erik-cernak	Erik Cernak	D	32	8478416	81	\N	\N	\N	1997-05-28	Kosice, SVK	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478416.png	R	230	\N	SVK	\N	\N	\N
363	victor-hedman	Victor Hedman	D	32	8475167	77	\N	\N	\N	1990-12-18	Ornskoldsvik, SWE	6'7"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475167.png	L	244	\N	SWE	\N	\N	\N
368	jonas-johansson	Jonas Johansson	G	32	8477992	31	\N	\N	\N	1995-09-19	Gavle, SWE	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477992.png	L	220	\N	SWE	\N	\N	\N
377	steven-lorentz	Steven Lorentz	C	2	8478904	18	\N	\N	\N	1996-04-13	Kitchener, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478904.png	L	219	\N	CAN	\N	\N	\N
382	jack-roslovic	Jack Roslovic	C	2	8478458	\N	\N	\N	\N	1997-01-29	Columbus, Ohio, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478458.png	R	198	\N	USA	\N	\N	\N
384	john-tavares	John Tavares	C	2	8475166	91	\N	\N	\N	1990-09-20	Mississauga, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475166.png	L	217	\N	CAN	\N	\N	\N
390	morgan-rielly	Morgan Rielly	D	2	8476853	44	\N	\N	\N	1994-03-09	Vancouver, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476853.png	L	219	\N	CAN	\N	\N	\N
392	chris-tanev	Chris Tanev	D	2	8475690	8	\N	\N	\N	1989-12-20	Toronto, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475690.png	R	200	\N	CAN	\N	\N	\N
432	marco-rossi	Marco Rossi	C	35	8482079	93	\N	\N	\N	2001-09-23	Feldkirch, AUT	5'9"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482079.png	L	182	\N	AUT	\N	\N	\N
474	anthony-beauvillier	Anthony Beauvillier	R	37	8478463	72	\N	\N	\N	1997-06-08	Sorel-Tracy, Quebec, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478463.png	L	181	\N	CAN	\N	\N	\N
477	boone-jenner	Boone Jenner	C	37	8476432	22	\N	\N	\N	1993-06-15	Dorchester, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476432.png	L	204	\N	CAN	\N	\N	\N
487	tom-wilson	Tom Wilson	R	37	8476880	43	\N	\N	\N	1994-03-29	Toronto, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476880.png	R	225	\N	CAN	\N	\N	\N
492	timothy-liljegren	Timothy Liljegren	D	37	8480043	27	\N	\N	\N	1999-04-30	Kristianstad, SWE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480043.png	R	200	\N	SWE	\N	\N	\N
495	rasmus-sandin	Rasmus Sandin	D	37	8480873	38	\N	\N	\N	2000-03-07	Uppsala, SWE	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480873.png	L	189	\N	SWE	\N	\N	\N
503	cole-koepke	Cole Koepke	L	38	8481043	45	\N	\N	\N	1998-05-17	Two Harbors, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481043.png	L	207	\N	USA	\N	\N	\N
511	dylan-demelo	Dylan DeMelo	D	38	8476331	2	\N	\N	\N	1993-05-01	London, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476331.png	R	194	\N	CAN	\N	\N	\N
516	dylan-samberg	Dylan Samberg	D	38	8480049	54	\N	\N	\N	1999-01-24	Saginaw, Minnesota, USA	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480049.png	L	216	\N	USA	\N	\N	\N
527	alex-killorn	Alex Killorn	L	7	8473986	17	\N	\N	\N	1989-09-14	Halifax, Nova Scotia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8473986.png	L	205	\N	CAN	\N	\N	\N
533	troy-terry	Troy Terry	R	7	8478873	19	\N	\N	\N	1997-09-10	Denver, Colorado, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478873.png	R	193	\N	USA	\N	\N	\N
534	frank-vatrano	Frank Vatrano	R	7	8478366	77	\N	\N	\N	1994-03-14	East Longmeadow, Massachusetts, USA	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478366.png	L	203	\N	USA	\N	\N	\N
541	pavel-mintyukov	Pavel Mintyukov	D	7	8483490	98	\N	\N	\N	2003-11-25	Moscow, RUS	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483490.png	L	207	\N	RUS	\N	\N	\N
550	michael-eyssimont	Michael Eyssimont	C	3	8479591	81	\N	\N	\N	1996-09-09	Littleton, Colorado, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479591.png	L	195	\N	USA	\N	\N	\N
553	tanner-jeannot	Tanner Jeannot	L	3	8479661	84	\N	\N	\N	1997-05-29	Estevan, Saskatchewan, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479661.png	L	221	\N	CAN	\N	\N	\N
558	fraser-minten	Fraser Minten	C	3	8483489	93	\N	\N	\N	2004-07-05	Vancouver, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483489.png	L	204	\N	CAN	\N	\N	\N
561	jj-peterka	JJ Peterka	R	3	8482175	\N	\N	\N	\N	2002-01-14	Munich, DEU	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482175.png	L	189	\N	DEU	\N	\N	\N
468	jaycob-megna	Jaycob Megna	D	306	8477034	88	\N	\N	\N	1992-12-10	Plantation, Florida, USA	6'6	https://assets.nhle.com/mugs/nhl/latest/168x168/8477034.png	L	214	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5547	5547	jamie-drysdale
460	kai-uchacz	Kai Uchacz	F	306	8485251	77	\N	\N	\N	2003-06-24	Calgary, Alberta, CAN	6'2	https://assets.nhle.com/mugs/nhl/latest/168x168/8485251.png	R	206	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10284	10284	jamie-drysdale
542	travis-mitchell	Travis Mitchell	D	326	8484262	\N	\N	\N	\N	1999-11-25	South Lyon, Michigan, USA	6'4	https://assets.nhle.com/mugs/nhl/latest/168x168/8484262.png	L	203	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9689	9689	jamie-drysdale
575	sam-carrick	Sam Carrick	C	9	8475842	10	\N	\N	\N	1992-02-04	Stouffville, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475842.png	R	202	\N	CAN	\N	\N	\N
583	beck-malenstyn	Beck Malenstyn	L	9	8479359	29	\N	\N	\N	1998-02-04	Delta, British Columbia, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479359.png	L	209	\N	CAN	\N	\N	\N
470	parker-wotherspoon	Parker Wotherspoon	D	36	8478450	29	\N	\N	\N	1997-08-24	Surrey, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478450.png	L	190	\N	CAN	\N	\N	\N
4811	andrew-cristall	Andrew Cristall	L	307	\N	\N	\N	\N	\N	2005-02-04	\N	5'10	\N	L	167	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10174	10174	jamie-drysdale
592	rasmus-dahlin	Rasmus Dahlin	D	9	8480839	26	\N	\N	\N	2000-04-13	Lidkoping, SWE	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480839.png	L	204	\N	SWE	\N	\N	\N
601	olen-zellweger	Olen Zellweger	D	9	8482803	\N	\N	\N	\N	2003-09-10	Calgary, Alberta, CAN	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482803.png	L	193	\N	CAN	\N	\N	\N
604	alex-lyon	Alex Lyon	G	9	8479312	34	\N	\N	\N	1992-12-09	Baudette, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479312.png	L	199	\N	USA	\N	\N	\N
609	morgan-frost	Morgan Frost	C	10	8480028	16	\N	\N	\N	1999-05-14	Aurora, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480028.png	L	193	\N	CAN	\N	\N	\N
612	samuel-honzek	Samuel Honzek	L	10	8484180	29	\N	\N	\N	2004-11-12	Trencin, SVK	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484180.png	L	186	\N	SVK	\N	\N	\N
618	yegor-sharangovich	Yegor Sharangovich	C	10	8481068	17	\N	\N	\N	1998-06-06	Minsk, BLR	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481068.png	L	196	\N	BLR	\N	\N	\N
621	maxim-tsyplakov	Maxim Tsyplakov	R	10	8484958	72	\N	\N	\N	1998-09-19	Moscow, RUS	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484958.png	L	203	\N	RUS	\N	\N	\N
627	jake-middleton	Jake Middleton	D	10	8478136	55	\N	\N	\N	1996-01-02	Wainwright, Alberta, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478136.png	L	219	\N	CAN	\N	\N	\N
632	abram-wiebe	Abram Wiebe	D	10	8483709	52	\N	\N	\N	2003-08-28	Mission, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483709.png	L	187	\N	CAN	\N	\N	\N
641	mark-jankowski	Mark Jankowski	L	11	8476873	77	\N	\N	\N	1994-09-13	Hamilton, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476873.png	L	200	\N	CAN	\N	\N	\N
643	jesperi-kotkaniemi	Jesperi Kotkaniemi	C	11	8480829	82	\N	\N	\N	2000-07-06	Pori, FIN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480829.png	L	212	\N	FIN	\N	\N	\N
649	jalen-chatfield	Jalen Chatfield	D	11	8478970	5	\N	\N	\N	1996-05-15	Ypsilanti, Michigan, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478970.png	R	209	\N	USA	\N	\N	\N
654	sean-walker	Sean Walker	D	11	8480336	26	\N	\N	\N	1994-11-13	Keswick, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480336.png	R	191	\N	CAN	\N	\N	\N
656	pyotr-kochetkov	Pyotr Kochetkov	G	11	8481611	52	\N	\N	\N	1999-06-25	Penza, RUS	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481611.png	L	196	\N	RUS	\N	\N	\N
661	anton-frondell	Anton Frondell	C	12	8485391	16	\N	\N	\N	2007-05-07	Trangsund, SWE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8485391.png	L	198	\N	SWE	\N	\N	\N
669	cole-smith	Cole Smith	L	12	8482062	\N	\N	\N	\N	1995-10-28	Brainerd, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482062.png	L	195	\N	USA	\N	\N	\N
675	wyatt-kaiser	Wyatt Kaiser	D	12	8482176	44	\N	\N	\N	2002-07-31	Andover, Minnesota, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482176.png	L	190	\N	USA	\N	\N	\N
684	nazem-kadri	Nazem Kadri	C	13	8475172	91	\N	\N	\N	1990-10-06	London, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475172.png	L	185	\N	CAN	\N	\N	\N
686	gabriel-landeskog	Gabriel Landeskog	L	13	8476455	92	\N	\N	\N	1992-11-23	Stockholm, SWE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476455.png	L	215	\N	SWE	\N	\N	\N
693	jaden-schwartz	Jaden Schwartz	C	13	8475768	\N	\N	\N	\N	1992-06-25	Wilcox, Saskatchewan, CAN	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475768.png	L	185	\N	CAN	\N	\N	\N
697	brett-kulak	Brett Kulak	D	13	8476967	27	\N	\N	\N	1994-01-06	Edmonton, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476967.png	L	192	\N	CAN	\N	\N	\N
587	jack-quinn	Jack Quinn	R	9	8482097	22	\N	\N	\N	2001-09-19	Ottawa, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482097.png	R	185	\N	CAN	\N	\N	\N
588	conor-sheary	Conor Sheary	L	9	8477839	43	\N	\N	\N	1992-06-08	Winchester, Massachusetts, USA	5'8"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477839.png	L	180	\N	USA	\N	\N	\N
712	valeri-nichushkin	Valeri Nichushkin	R	14	8477501	43	\N	\N	\N	1995-03-04	Chelyabinsk, RUS	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477501.png	L	210	\N	RUS	\N	\N	\N
714	cole-sillinger	Cole Sillinger	C	14	8482705	4	\N	\N	\N	2003-05-16	Columbus, Ohio, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482705.png	L	202	\N	USA	\N	\N	\N
720	denton-mateychuk	Denton Mateychuk	D	14	8483485	5	\N	\N	\N	2004-07-12	Winnipeg, Manitoba, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483485.png	L	188	\N	CAN	\N	\N	\N
722	damon-severson	Damon Severson	D	14	8476923	78	\N	\N	\N	1994-08-07	Melville, Saskatchewan, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476923.png	R	204	\N	CAN	\N	\N	\N
728	oskar-bck	Oskar Bäck	C	15	8480840	10	\N	\N	\N	2000-03-12	Karlstad, SWE	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480840.png	L	207	\N	SWE	\N	\N	\N
734	wyatt-johnston	Wyatt Johnston	C	15	8482740	53	\N	\N	\N	2003-05-14	Toronto, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482740.png	R	187	\N	CAN	\N	\N	\N
737	jason-robertson	Jason Robertson	L	15	8480027	21	\N	\N	\N	1999-07-22	Arcadia, California, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480027.png	L	204	\N	USA	\N	\N	\N
740	lian-bichsel	Lian Bichsel	D	15	8483425	6	\N	\N	\N	2004-05-18	Olten, CHE	6'7"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483425.png	L	237	\N	CHE	\N	\N	\N
610	matvei-gridin	Matvei Gridin	F	298	8484860	92	\N	\N	\N	2006-03-01	Kurgan, RUS	6'1	https://assets.nhle.com/mugs/nhl/latest/168x168/8484860.png	L	182	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10923	10923	jamie-drysdale
573	jeremy-swayman	Jeremy Swayman	G	3	8480280	1	\N	\N	\N	1998-11-24	Anchorage, Alaska, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480280.png	L	195	\N	USA	\N	\N	\N
665	andrew-mangiapane	Andrew Mangiapane	R	296	8478233	26	\N	\N	\N	1996-04-04	Toronto, Ontario, CAN	5'10	https://assets.nhle.com/mugs/nhl/latest/168x168/8478233.png	L	183	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6476	6476	jamie-drysdale
752	andrew-copp	Andrew Copp	C	16	8477429	18	\N	\N	\N	1994-07-08	Ann Arbor, Michigan, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477429.png	L	200	\N	USA	\N	\N	\N
757	dylan-larkin	Dylan Larkin	C	16	8477946	71	\N	\N	\N	1996-07-30	Waterford, Michigan, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477946.png	L	204	\N	USA	\N	\N	\N
760	jacob-bernard-docker	Jacob Bernard-Docker	D	16	8480879	25	\N	\N	\N	2000-06-30	Canmore, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480879.png	R	196	\N	CAN	\N	\N	\N
766	moritz-seider	Moritz Seider	D	16	8481542	53	\N	\N	\N	2001-04-06	Zell, DEU	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481542.png	R	210	\N	DEU	\N	\N	\N
768	daniil-tarasov	Daniil Tarasov	G	16	8480193	\N	\N	\N	\N	1999-03-27	Novokuznetsk, RUS	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480193.png	L	203	\N	RUS	\N	\N	\N
796	lars-eller	Lars Eller	C	18	8474189	20	\N	\N	\N	1989-05-08	Rodovre, DNK	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8474189.png	L	207	\N	DNK	\N	\N	\N
799	sam-lafferty	Sam Lafferty	C	18	8478043	18	\N	\N	\N	1995-03-06	Hollidaysburg, Pennsylvania, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478043.png	R	205	\N	USA	\N	\N	\N
804	sam-reinhart	Sam Reinhart	C	18	8477933	13	\N	\N	\N	1995-11-06	West Vancouver, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477933.png	R	196	\N	CAN	\N	\N	\N
807	matthew-tkachuk	Matthew Tkachuk	L	18	8479314	19	\N	\N	\N	1997-12-11	Scottsdale, Arizona, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479314.png	L	202	\N	USA	\N	\N	\N
814	dmitry-kulikov	Dmitry Kulikov	D	18	8475179	7	\N	\N	\N	1990-10-29	Lipetsk, RUS	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475179.png	L	212	\N	RUS	\N	\N	\N
199	michael-amadio	Michael Amadio	R	26	8478020	22	\N	\N	\N	1996-05-13	Sault Ste. Marie, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478020.png	R	206	\N	CAN	\N	\N	\N
235	nikita-grebenkin	Nikita Grebenkin	R	27	8483733	29	\N	\N	\N	2003-05-02	Serov, RUS	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483733.png	L	210	\N	RUS	\N	\N	\N
270	elmer-soderblom	Elmer Soderblom	L	28	8481725	25	\N	\N	\N	2001-07-05	Gothenburg, SWE	6'8"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481725.png	L	252	\N	SWE	\N	\N	\N
306	bobby-mcmann	Bobby McMann	C	30	8482259	74	\N	\N	\N	1996-06-15	Wainwright, Alberta, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482259.png	L	217	\N	CAN	\N	\N	\N
705	adam-fantilli	Adam Fantilli	C	14	8484166	19	\N	\N	\N	2004-10-12	Nobleton, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484166.png	L	205	\N	CAN	\N	\N	\N
456	mitch-marner	Mitch Marner	R	36	8478483	93	\N	\N	\N	1997-05-05	Markham, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478483.png	R	180	\N	CAN	\N	\N	\N
491	cole-hutson	Cole Hutson	D	37	8484873	44	\N	\N	\N	2006-06-28	St. Louis, Missouri, USA	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484873.png	L	175	\N	USA	\N	\N	\N
505	vladislav-namestnikov	Vladislav Namestnikov	C	38	8476480	7	\N	\N	\N	1992-11-22	Zhukovskiy, RUS	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476480.png	L	181	\N	RUS	\N	\N	\N
563	pavel-zacha	Pavel Zacha	C	3	8478401	18	\N	\N	\N	1997-04-06	Brno, CZE	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478401.png	L	211	\N	CZE	\N	\N	\N
591	louis-crevier	Louis Crevier	D	9	8481806	\N	\N	\N	\N	2001-05-04	Quebec City, Quebec, CAN	6'8"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481806.png	R	228	\N	CAN	\N	\N	\N
603	ukko-pekka-luukkonen	Ukko-Pekka Luukkonen	G	9	8480045	1	\N	\N	\N	1999-03-09	Espoo, FIN	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480045.png	L	223	\N	FIN	\N	\N	\N
638	nicolas-deslauriers	Nicolas Deslauriers	L	11	8475235	44	\N	\N	\N	1991-02-22	LaSalle, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475235.png	L	218	\N	CAN	\N	\N	\N
660	ryan-donato	Ryan Donato	C	12	8477987	8	\N	\N	\N	1996-04-09	Boston, Massachusetts, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477987.png	L	190	\N	USA	\N	\N	\N
701	devon-toews	Devon Toews	D	13	8478038	7	\N	\N	\N	1994-02-21	Abbotsford, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478038.png	L	191	\N	CAN	\N	\N	\N
730	radek-faksa	Radek Faksa	C	15	8476889	12	\N	\N	\N	1994-01-09	Vitkov, CZE	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476889.png	L	216	\N	CZE	\N	\N	\N
749	mason-appleton	Mason Appleton	C	16	8478891	22	\N	\N	\N	1996-01-15	Green Bay, Wisconsin, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478891.png	R	196	\N	USA	\N	\N	\N
763	simon-edvinsson	Simon Edvinsson	D	16	8482762	77	\N	\N	\N	2003-02-05	Kungsbacka, SWE	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482762.png	L	222	\N	SWE	\N	\N	\N
811	gustav-forsling	Gustav Forsling	D	18	8478055	42	\N	\N	\N	1996-06-12	Linkoping, SWE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478055.png	L	199	\N	SWE	\N	\N	\N
31	alex-laferriere	Alex Laferriere	R	19	8482155	14	\N	\N	\N	2001-10-28	Chatham, New Jersey, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482155.png	R	205	\N	USA	\N	\N	\N
82	cole-caufield	Cole Caufield	R	21	8481540	13	\N	\N	\N	2001-01-02	Mosinee, Wisconsin, USA	5'8"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481540.png	R	175	\N	USA	\N	\N	\N
94	noah-dobson	Noah Dobson	D	21	8480865	53	\N	\N	\N	2000-01-07	Summerside, Prince Edward Island, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480865.png	R	200	\N	CAN	\N	\N	\N
134	arseny-gritsyuk	Arseny Gritsyuk	R	23	8481721	81	\N	\N	\N	2001-03-15	Krasnoyarsk, RUS	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481721.png	L	195	\N	RUS	\N	\N	\N
155	simon-holmstrom	Simon Holmstrom	R	24	8481601	92	\N	\N	\N	2001-05-24	Tranas, SWE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481601.png	L	208	\N	SWE	\N	\N	\N
190	vladislav-gavrikov	Vladislav Gavrikov	D	25	8478882	44	\N	\N	\N	1995-11-21	Yaroslavl, RUS	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478882.png	L	210	\N	RUS	\N	\N	\N
318	brandon-montour	Brandon Montour	D	30	8477986	62	\N	\N	\N	1994-04-11	Brantford, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477986.png	R	199	\N	CAN	\N	\N	\N
210	hayden-hodgson	Hayden Hodgson	R	297	8478173	42	\N	\N	\N	1996-03-02	Windsor, Ontario, CAN	6'2	https://assets.nhle.com/mugs/nhl/latest/168x168/8478173.png	R	226	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6653	6653	jamie-drysdale
748	jake-oettinger	Jake Oettinger	G	15	8479979	29	\N	\N	\N	1998-12-18	Lakeville, Minnesota, USA	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479979.png	L	225	\N	USA	\N	\N	\N
244	oliver-bonk	Oliver Bonk	D	310	8484148	59	\N	\N	\N	2005-01-09	Ottawa, Ontario, CAN	6'2	https://assets.nhle.com/mugs/nhl/latest/168x168/8484148.png	R	180	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10722	10722	jamie-drysdale
324	jack-finley	Jack Finley	C	320	8482090	37	\N	\N	\N	2002-09-02	St. Louis, Missouri, USA	6'6	https://assets.nhle.com/mugs/nhl/latest/168x168/8482090.png	R	227	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8482	8482	jamie-drysdale
124	nick-perbix	Nick Perbix	D	22	8480246	48	\N	\N	\N	1998-06-15	Elk River, Minnesota, USA	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480246.png	R	206	\N	USA	\N	\N	\N
116	ryan-oreilly	Ryan O'Reilly	C	22	8475158	90	\N	\N	\N	1991-02-07	Clinton, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475158.png	L	207	\N	CAN	\N	\N	\N
128	juuse-saros	Juuse Saros	G	22	8477424	74	\N	\N	\N	1995-04-19	Forssa, FIN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477424.png	L	180	\N	FIN	\N	\N	\N
133	cody-glass	Cody Glass	C	23	8479996	12	\N	\N	\N	1999-04-01	Winnipeg, Manitoba, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479996.png	R	201	\N	CAN	\N	\N	\N
5739	ethan-leyh	Ethan Leyh	L	300	\N	\N	\N	\N	\N	2001-09-07	\N	6.00	\N	L	195	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10776	10776	jamie-drysdale
139	dawson-mercer	Dawson Mercer	C	23	8482110	91	\N	\N	\N	2001-10-27	Carbonear, Newfoundland and Labrador, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482110.png	R	180	\N	CAN	\N	\N	\N
147	brett-pesce	Brett Pesce	D	23	8477488	22	\N	\N	\N	1994-11-15	Tarrytown, New York, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477488.png	R	206	\N	USA	\N	\N	\N
152	casey-cizikas	Casey Cizikas	C	24	8475231	53	\N	\N	\N	1991-02-27	Toronto, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475231.png	L	191	\N	CAN	\N	\N	\N
158	kyle-maclean	Kyle MacLean	C	24	8481237	32	\N	\N	\N	1999-04-29	Verona, New Jersey, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481237.png	L	190	\N	USA	\N	\N	\N
164	matthew-kessel	Matthew Kessel	D	24	8482516	\N	\N	\N	\N	2000-06-23	Bloomfield Hills, Michigan, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482516.png	R	212	\N	USA	\N	\N	\N
170	ilya-sorokin	Ilya Sorokin	G	24	8478009	30	\N	\N	\N	1995-08-04	Mezhdurechensk, RUS	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478009.png	L	189	\N	RUS	\N	\N	\N
175	will-cuylle	Will Cuylle	L	25	8482157	50	\N	\N	\N	2002-02-05	Toronto, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482157.png	L	212	\N	CAN	\N	\N	\N
307	ben-meyers	Ben Meyers	F	302	8483570	59	\N	\N	\N	1998-11-15	Delano, Minnesota, USA	5'11	https://assets.nhle.com/mugs/nhl/latest/168x168/8483570.png	L	194	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9225	9225	jamie-drysdale
193	matthew-robertson	Matthew Robertson	D	25	8481525	29	\N	\N	\N	2001-03-09	Edmonton, Alberta, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481525.png	L	210	\N	CAN	\N	\N	\N
200	drake-batherson	Drake Batherson	R	26	8480208	19	\N	\N	\N	1998-04-27	Fort Wayne, Indiana, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480208.png	R	209	\N	USA	\N	\N	\N
206	warren-foegele	Warren Foegele	L	26	8477998	37	\N	\N	\N	1996-04-01	Markham, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477998.png	L	205	\N	CAN	\N	\N	\N
218	tyler-kleven	Tyler Kleven	D	26	8482095	43	\N	\N	\N	2002-01-10	Fargo, North Dakota, USA	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482095.png	L	225	\N	USA	\N	\N	\N
224	samuel-ersson	Samuel Ersson	G	26	8481035	\N	\N	\N	\N	1999-10-20	Falun, SWE	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481035.png	L	194	\N	SWE	\N	\N	\N
422	brock-boeser	Brock Boeser	R	35	8478444	6	\N	\N	\N	1997-02-25	Burnsville, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478444.png	R	208	\N	USA	\N	\N	\N
242	trevor-zegras	Trevor Zegras	C	27	8481533	46	\N	\N	\N	2001-03-20	Bedford, New York, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481533.png	L	185	\N	USA	\N	\N	\N
251	nick-seeler	Nick Seeler	D	27	8476372	24	\N	\N	\N	1993-06-03	Eden Prairie, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476372.png	L	197	\N	USA	\N	\N	\N
257	justin-brazeau	Justin Brazeau	R	28	8479638	16	\N	\N	\N	1998-02-02	New Liskeard, Ontario, CAN	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479638.png	R	232	\N	CAN	\N	\N	\N
262	andrei-kuzmenko	Andrei Kuzmenko	L	28	8483808	\N	\N	\N	\N	1996-02-04	Yakutsk, RUS	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483808.png	R	200	\N	RUS	\N	\N	\N
269	bryan-rust	Bryan Rust	R	28	8475810	17	\N	\N	\N	1992-05-11	Pontiac, Michigan, USA	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475810.png	R	202	\N	USA	\N	\N	\N
274	erik-karlsson	Erik Karlsson	D	28	8474578	65	\N	\N	\N	1990-05-31	Landsbro, SWE	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8474578.png	R	185	\N	SWE	\N	\N	\N
281	ty-dellandrea	Ty Dellandrea	C	29	8480848	10	\N	\N	\N	2000-07-21	Port Perry, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480848.png	R	185	\N	CAN	\N	\N	\N
290	tyler-toffoli	Tyler Toffoli	C	29	8475726	73	\N	\N	\N	1992-04-24	Scarborough, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475726.png	R	205	\N	CAN	\N	\N	\N
296	jacob-trouba	Jacob Trouba	D	29	8476885	65	\N	\N	\N	1994-02-26	Rochester, Michigan, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476885.png	R	212	\N	USA	\N	\N	\N
303	frederick-gaudreau	Frederick Gaudreau	C	30	8477919	89	\N	\N	\N	1993-05-01	Bromont, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477919.png	R	184	\N	CAN	\N	\N	\N
309	chandler-stephenson	Chandler Stephenson	C	30	8476905	9	\N	\N	\N	1994-04-22	Saskatoon, Saskatchewan, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476905.png	L	201	\N	CAN	\N	\N	\N
317	joshua-mahura	Joshua Mahura	D	30	8479372	28	\N	\N	\N	1998-05-05	St. Albert, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479372.png	L	193	\N	CAN	\N	\N	\N
328	mason-mctavish	Mason McTavish	C	31	8482745	\N	\N	\N	\N	2003-01-30	Zurich, CHE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482745.png	L	219	\N	CHE	\N	\N	\N
334	alexey-toropchenko	Alexey Toropchenko	R	31	8480281	13	\N	\N	\N	1999-06-25	Moscow, RUS	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480281.png	L	225	\N	RUS	\N	\N	\N
340	colton-parayko	Colton Parayko	D	31	8476892	55	\N	\N	\N	1993-05-12	St. Albert, Alberta, CAN	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476892.png	R	228	\N	CAN	\N	\N	\N
379	auston-matthews	Auston Matthews	C	2	8479318	34	\N	\N	\N	1997-09-17	San Ramon, California, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479318.png	L	215	\N	USA	\N	\N	\N
187	sean-durzi	Sean Durzi	D	25	8480434	5	\N	\N	\N	1998-10-21	Mississauga, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480434.png	R	196	\N	CAN	\N	\N	\N
6	zach-hyman	Zach Hyman	L	1	8475786	18	\N	\N	\N	1992-06-09	Toronto, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475786.png	R	206	\N	CAN	\N	\N	\N
434	zeev-buium	Zeev Buium	D	35	8484798	24	\N	\N	\N	2005-12-07	San Diego, California, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484798.png	L	183	\N	USA	\N	\N	\N
448	jack-eichel	Jack Eichel	C	36	8478403	9	\N	\N	\N	1996-10-28	North Chelmsford, Massachusetts, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478403.png	R	208	\N	USA	\N	\N	\N
626	yan-kuznetsov	Yan Kuznetsov	D	298	8482165	37	\N	\N	\N	2002-03-09	Murmansk, RUS	6'4	https://assets.nhle.com/mugs/nhl/latest/168x168/8482165.png	L	209	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8673	8673	jamie-drysdale
457	victor-olofsson	Victor Olofsson	R	36	8478109	95	\N	\N	\N	1995-07-18	Ornskoldsvik, SWE	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478109.png	L	180	\N	SWE	\N	\N	\N
461	rasmus-andersson	Rasmus Andersson	D	36	8478397	4	\N	\N	\N	1996-10-27	Malmo, SWE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478397.png	R	202	\N	SWE	\N	\N	\N
467	brayden-mcnabb	Brayden McNabb	D	36	8475188	3	\N	\N	\N	1991-01-21	Davidson, Saskatchewan, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475188.png	L	215	\N	CAN	\N	\N	\N
355	ilya-mikheyev	Ilya Mikheyev	R	32	8481624	95	\N	\N	\N	1994-10-10	Omsk, RUS	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481624.png	L	192	\N	RUS	\N	\N	\N
359	john-carlson	John Carlson	D	32	8474590	74	\N	\N	\N	1990-01-10	Natick, Massachusetts, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8474590.png	R	220	\N	USA	\N	\N	\N
367	dennis-hildeby	Dennis Hildeby	G	32	8483710	35	\N	\N	\N	2001-08-19	Jarfalla, SWE	6'7"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483710.png	L	231	\N	SWE	\N	\N	\N
373	bo-groulx	Bo Groulx	C	2	8480870	29	\N	\N	\N	2000-02-06	Rouen, FRA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480870.png	L	202	\N	FRA	\N	\N	\N
376	matthew-knies	Matthew Knies	L	2	8482720	23	\N	\N	\N	2002-10-17	Phoenix, Arizona, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482720.png	L	232	\N	USA	\N	\N	\N
383	colton-sissons	Colton Sissons	C	2	8476925	\N	\N	\N	\N	1993-11-05	North Vancouver, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476925.png	R	200	\N	CAN	\N	\N	\N
389	darren-raddysh	Darren Raddysh	D	2	8478178	\N	\N	\N	\N	1996-02-28	Toronto, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478178.png	R	202	\N	CAN	\N	\N	\N
397	logan-cooley	Logan Cooley	C	34	8483431	92	\N	\N	\N	2004-05-04	Pittsburgh, Pennsylvania, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483431.png	L	191	\N	USA	\N	\N	\N
439	luke-schenn	Luke Schenn	D	35	8474568	2	\N	\N	\N	1989-11-02	Saskatoon, Saskatchewan, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8474568.png	R	225	\N	CAN	\N	\N	\N
472	adin-hill	Adin Hill	G	36	8478499	33	\N	\N	\N	1996-05-11	Comox, British Columbia, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478499.png	L	222	\N	CAN	\N	\N	\N
475	pierre-luc-dubois	Pierre-Luc Dubois	C	37	8479400	80	\N	\N	\N	1998-06-24	Ste-Agathe-des-Monts, Quebec, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479400.png	L	220	\N	CAN	\N	\N	\N
481	alex-ovechkin	Alex Ovechkin	L	37	8471214	8	\N	\N	\N	1985-09-17	Moscow, RUS	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8471214.png	R	238	\N	RUS	\N	\N	\N
485	dylan-strome	Dylan Strome	C	37	8478440	17	\N	\N	\N	1997-03-07	Mississauga, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478440.png	L	200	\N	CAN	\N	\N	\N
493	dylan-mcilrath	Dylan McIlrath	D	37	8475795	52	\N	\N	\N	1992-04-20	Winnipeg, Manitoba, CAN	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475795.png	R	240	\N	CAN	\N	\N	\N
499	morgan-barron	Morgan Barron	C	38	8480289	36	\N	\N	\N	1998-12-02	Halifax, Nova Scotia, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480289.png	L	220	\N	CAN	\N	\N	\N
504	adam-lowry	Adam Lowry	C	38	8476392	17	\N	\N	\N	1993-03-29	St. Louis, Missouri, USA	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476392.png	L	210	\N	USA	\N	\N	\N
510	gabriel-vilardi	Gabriel Vilardi	C	38	8480014	13	\N	\N	\N	1999-08-16	Kingston, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480014.png	R	216	\N	CAN	\N	\N	\N
517	john-st-ivany	John St. Ivany	D	38	8481030	6	\N	\N	\N	1999-07-22	Manhattan Beach, California, USA	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481030.png	R	197	\N	USA	\N	\N	\N
525	aj-greer	A.J. Greer	L	7	8478421	\N	\N	\N	\N	1996-12-14	Joliette, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478421.png	L	224	\N	CAN	\N	\N	\N
528	chris-kreider	Chris Kreider	L	7	8475184	20	\N	\N	\N	1991-04-30	Boxford, Massachusetts, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475184.png	L	232	\N	USA	\N	\N	\N
565	will-borgen	Will Borgen	D	3	8478840	\N	\N	\N	\N	1996-12-19	Moorhead, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478840.png	R	199	\N	USA	\N	\N	\N
571	charlie-mcavoy	Charlie McAvoy	D	3	8479325	73	\N	\N	\N	1997-12-21	Long Beach, New York, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479325.png	R	211	\N	USA	\N	\N	\N
577	josh-doan	Josh Doan	R	9	8482659	91	\N	\N	\N	2002-02-01	Scottsdale, Arizona, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482659.png	R	198	\N	USA	\N	\N	\N
469	shea-theodore	Shea Theodore	D	36	8477447	27	\N	\N	\N	1995-08-03	Aldergrove, British Columbia, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477447.png	L	197	\N	CAN	\N	\N	\N
590	jason-zucker	Jason Zucker	L	9	8475722	17	\N	\N	\N	1992-01-16	Newport Beach, California, USA	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475722.png	L	198	\N	USA	\N	\N	\N
600	conor-timmins	Conor Timmins	D	9	8479982	21	\N	\N	\N	1998-09-18	St. Catharines, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479982.png	R	213	\N	CAN	\N	\N	\N
119	matthew-wood	Matthew Wood	L	312	8484241	71	\N	\N	\N	2005-02-06	Nanaimo, British Columbia, CAN	6'4	https://assets.nhle.com/mugs/nhl/latest/168x168/8484241.png	R	202	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10921	10921	jamie-drysdale
619	ryan-strome	Ryan Strome	C	10	8476458	22	\N	\N	\N	1993-07-11	Mississauga, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476458.png	R	192	\N	CAN	\N	\N	\N
526	james-hamblin	James Hamblin	C	296	8480468	\N	\N	\N	\N	1999-04-27	Edmonton, Alberta, CAN	5'10	https://assets.nhle.com/mugs/nhl/latest/168x168/8480468.png	L	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8485	8485	jamie-drysdale
559	casey-mittelstadt	Casey Mittelstadt	C	3	8479999	11	\N	\N	\N	1998-11-22	Eden Prairie, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479999.png	L	205	\N	USA	\N	\N	\N
613	jonathan-huberdeau	Jonathan Huberdeau	L	10	8476456	10	\N	\N	\N	1993-06-04	Saint-Jerome, Quebec, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476456.png	L	200	\N	CAN	\N	\N	\N
625	joel-hanley	Joel Hanley	D	10	8477810	44	\N	\N	\N	1991-06-08	Keswick, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477810.png	L	186	\N	CAN	\N	\N	\N
45	erik-gustafsson	Erik Gustafsson	D	304	8476979	\N	\N	\N	\N	1992-03-14	Nynashamn, SWE	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8476979.png	L	190	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6103	6103	jamie-drysdale
636	jackson-blake	Jackson Blake	R	11	8482809	53	\N	\N	\N	2003-08-03	Fargo, North Dakota, USA	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482809.png	R	185	\N	USA	\N	\N	\N
642	seth-jarvis	Seth Jarvis	R	11	8482093	24	\N	\N	\N	2002-02-01	Winnipeg, Manitoba, CAN	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482093.png	R	180	\N	CAN	\N	\N	\N
648	andrei-svechnikov	Andrei Svechnikov	R	11	8480830	37	\N	\N	\N	2000-03-26	Barnaul, RUS	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480830.png	L	200	\N	RUS	\N	\N	\N
655	brandon-bussi	Brandon Bussi	G	11	8483548	32	\N	\N	\N	1998-06-25	Sound Beach, New York, USA	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483548.png	R	218	\N	USA	\N	\N	\N
662	ryan-greene	Ryan Greene	C	12	8483450	20	\N	\N	\N	2003-10-21	St. John's, Newfoundland and Labrador, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483450.png	R	195	\N	CAN	\N	\N	\N
462	dylan-coghlan	Dylan Coghlan	D	306	8479639	52	\N	\N	\N	1998-02-19	Duncan, British Columbia, CAN	6'2	https://assets.nhle.com/mugs/nhl/latest/168x168/8479639.png	R	205	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7267	7267	jamie-drysdale
685	parker-kelly	Parker Kelly	C	13	8480448	17	\N	\N	\N	1999-05-14	Camrose, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480448.png	L	185	\N	CAN	\N	\N	\N
691	logan-oconnor	Logan O'Connor	R	13	8481186	25	\N	\N	\N	1996-08-14	Missouri City, Texas, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481186.png	R	175	\N	USA	\N	\N	\N
698	cale-makar	Cale Makar	D	13	8480069	8	\N	\N	\N	1998-10-30	Calgary, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480069.png	R	187	\N	CAN	\N	\N	\N
710	kirill-marchenko	Kirill Marchenko	R	14	8480893	86	\N	\N	\N	2000-07-21	Barnaul, RUS	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480893.png	R	201	\N	RUS	\N	\N	\N
711	sean-monahan	Sean Monahan	C	14	8477497	23	\N	\N	\N	1994-10-12	Brampton, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477497.png	L	206	\N	CAN	\N	\N	\N
719	erik-gudbranson	Erik Gudbranson	D	14	8475790	44	\N	\N	\N	1992-01-07	Ottawa, Ontario, CAN	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475790.png	R	222	\N	CAN	\N	\N	\N
724	jet-greaves	Jet Greaves	G	14	8482982	73	\N	\N	\N	2001-03-30	Cambridge, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482982.png	L	188	\N	CAN	\N	\N	\N
729	matt-duchene	Matt Duchene	C	15	8475168	95	\N	\N	\N	1991-01-16	Haliburton, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475168.png	L	211	\N	CAN	\N	\N	\N
738	tyler-seguin	Tyler Seguin	C	15	8475794	91	\N	\N	\N	1992-01-31	Brampton, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475794.png	R	205	\N	CAN	\N	\N	\N
743	miro-heiskanen	Miro Heiskanen	D	15	8480036	4	\N	\N	\N	1999-07-18	Espoo, FIN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480036.png	L	197	\N	FIN	\N	\N	\N
747	casey-desmith	Casey DeSmith	G	15	8479193	1	\N	\N	\N	1991-08-13	Rochester, New Hampshire, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479193.png	L	188	\N	USA	\N	\N	\N
753	alex-debrincat	Alex DeBrincat	R	16	8479337	93	\N	\N	\N	1997-12-18	Farmington Hills, Michigan, USA	5'8"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479337.png	R	180	\N	USA	\N	\N	\N
761	jacob-bryson	Jacob Bryson	D	16	8480196	\N	\N	\N	\N	1997-11-18	London, Ontario, CAN	5'9"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480196.png	L	177	\N	CAN	\N	\N	\N
767	john-gibson	John Gibson	G	16	8476434	36	\N	\N	\N	1993-07-14	Pittsburgh, Pennsylvania, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476434.png	L	209	\N	USA	\N	\N	\N
704	charlie-coyle	Charlie Coyle	C	14	8475745	3	\N	\N	\N	1992-03-02	East Weymouth, Massachusetts, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475745.png	R	221	\N	USA	\N	\N	\N
802	brad-marchand	Brad Marchand	L	18	8473419	63	\N	\N	\N	1988-05-11	Halifax, Nova Scotia, CAN	5'9"	https://assets.nhle.com/mugs/nhl/latest/168x168/8473419.png	L	180	\N	CAN	\N	\N	\N
808	carter-verhaeghe	Carter Verhaeghe	C	18	8477409	23	\N	\N	\N	1995-08-14	Toronto, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477409.png	L	183	\N	CAN	\N	\N	\N
813	seth-jones	Seth Jones	D	18	8477495	3	\N	\N	\N	1994-10-03	Arlington, Texas, USA	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477495.png	R	213	\N	USA	\N	\N	\N
817	donovan-sebrango	Donovan Sebrango	D	18	8482131	73	\N	\N	\N	2002-01-12	Ottawa, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482131.png	L	223	\N	CAN	\N	\N	\N
263	hendrix-lapierre	Hendrix Lapierre	C	28	8482148	\N	\N	\N	\N	2002-02-09	Gatineau, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482148.png	L	195	\N	CAN	\N	\N	\N
299	alex-nedeljkovic	Alex Nedeljkovic	G	29	8477968	33	\N	\N	\N	1996-01-07	Parma, Ohio, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477968.png	L	205	\N	USA	\N	\N	\N
246	helge-grans	Helge Grans	D	310	8482169	3	\N	\N	\N	2002-05-10	Ljungby, SWE	6'4	https://assets.nhle.com/mugs/nhl/latest/168x168/8482169.png	R	205	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8805	8805	jamie-drysdale
540	jackson-lacombe	Jackson LaCombe	D	7	8481605	2	\N	\N	\N	2001-01-09	Eden Prairie, Minnesota, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481605.png	L	208	\N	USA	\N	\N	\N
498	logan-thompson	Logan Thompson	G	37	8480313	48	\N	\N	\N	1997-02-25	Calgary, Alberta, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480313.png	R	207	\N	CAN	\N	\N	\N
798	garnet-hathaway	Garnet Hathaway	R	18	8477903	21	\N	\N	\N	1991-11-23	Naples, Florida, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477903.png	R	212	\N	USA	\N	\N	\N
569	hampus-lindholm	Hampus Lindholm	D	3	8476854	27	\N	\N	\N	1994-01-20	Helsingborg, SWE	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476854.png	L	217	\N	SWE	\N	\N	\N
217	cameron-crotty	Cameron Crotty	D	297	8480075	5	\N	\N	\N	1999-05-05	Ottawa, Ontario, CAN	6'3	https://assets.nhle.com/mugs/nhl/latest/168x168/8480075.png	R	213	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8412	8412	jamie-drysdale
679	alex-vlasic	Alex Vlasic	D	12	8481568	72	\N	\N	\N	2001-06-05	Wilmette, Illinois, USA	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481568.png	L	217	\N	USA	\N	\N	\N
386	oliver-ekman-larsson	Oliver Ekman-Larsson	D	2	8475171	95	\N	\N	\N	1991-07-17	Karlskrona, SWE	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475171.png	L	190	\N	SWE	\N	\N	\N
631	zach-whitecloud	Zach Whitecloud	D	10	8480727	28	\N	\N	\N	1996-11-28	Brandon, Manitoba, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480727.png	R	210	\N	CAN	\N	\N	\N
667	frank-nazar	Frank Nazar	C	12	8483493	91	\N	\N	\N	2004-01-14	Detroit, Michigan, USA	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483493.png	R	190	\N	USA	\N	\N	\N
118	ozzy-wiesblatt	Ozzy Wiesblatt	C	22	8482103	89	\N	\N	\N	2002-03-09	Calgary, Alberta, CAN	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482103.png	R	183	\N	CAN	\N	\N	\N
702	mackenzie-blackwood	Mackenzie Blackwood	G	13	8478406	39	\N	\N	\N	1996-12-09	Thunder Bay, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478406.png	L	225	\N	CAN	\N	\N	\N
736	mikko-rantanen	Mikko Rantanen	R	15	8478420	96	\N	\N	\N	1996-10-29	Nousiainen, FIN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478420.png	L	228	\N	FIN	\N	\N	\N
4	leon-draisaitl	Leon Draisaitl	C	1	8477934	29	\N	\N	\N	1995-10-27	Cologne, DEU	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477934.png	L	209	\N	DEU	\N	\N	\N
524	mikael-granlund	Mikael Granlund	C	7	8475798	64	\N	\N	\N	1992-02-26	Oulu, FIN	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475798.png	L	193	\N	FIN	\N	\N	\N
52	joel-eriksson-ek	Joel Eriksson Ek	C	20	8478493	14	\N	\N	\N	1997-01-29	Karlstad, SWE	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478493.png	L	207	\N	SWE	\N	\N	\N
88	alex-newhook	Alex Newhook	C	21	8481618	15	\N	\N	\N	2001-01-28	St. John's, Newfoundland and Labrador, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481618.png	L	200	\N	CAN	\N	\N	\N
127	justus-annunen	Justus Annunen	G	22	8481020	29	\N	\N	\N	2000-03-11	Kempele, FIN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481020.png	L	210	\N	FIN	\N	\N	\N
168	alexander-romanov	Alexander Romanov	D	24	8481014	28	\N	\N	\N	2000-01-06	Moscow, RUS	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481014.png	L	220	\N	RUS	\N	\N	\N
313	ryker-evans	Ryker Evans	D	30	8482858	41	\N	\N	\N	2001-12-13	Calgary, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482858.png	L	195	\N	CAN	\N	\N	\N
356	brayden-point	Brayden Point	C	32	8478010	21	\N	\N	\N	1996-03-13	Calgary, Alberta, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478010.png	R	177	\N	CAN	\N	\N	\N
70	carson-lambos	Carson Lambos	D	308	8482781	28	\N	\N	\N	2003-01-14	Winnipeg, Manitoba, CAN	6'1	https://assets.nhle.com/mugs/nhl/latest/168x168/8482781.png	L	197	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9856	9856	jamie-drysdale
650	shayne-gostisbehere	Shayne Gostisbehere	D	11	8476906	4	\N	\N	\N	1993-04-20	Pembroke Pines, Florida, USA	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476906.png	L	183	\N	USA	\N	\N	\N
236	carl-grundstrom	Carl Grundstrom	F	310	8479336	91	\N	\N	\N	1997-12-01	Umea, SWE	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8479336.png	L	200	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6788	6788	jamie-drysdale
205	william-eklund	William Eklund	L	26	8482667	\N	\N	\N	\N	2002-10-12	Stockholm, SWE	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482667.png	L	185	\N	SWE	\N	\N	\N
1	connor-mcdavid	Connor McDavid	C	1	8478402	97	12.5	2030	3	1997-01-13	Richmond Hill, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478402.png	L	194	\N	CAN	\N	\N	\N
29	samuel-helenius	Samuel Helenius	C	19	8482726	79	\N	\N	\N	2002-11-26	Dallas, Texas, USA	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482726.png	L	225	\N	USA	\N	\N	\N
47	anton-forsberg	Anton Forsberg	G	19	8476341	31	\N	\N	\N	1992-11-27	Härnösand, SWE	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476341.png	L	200	\N	SWE	\N	\N	\N
54	nick-foligno	Nick Foligno	L	20	8473422	71	\N	\N	\N	1987-10-31	Buffalo, New York, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8473422.png	L	210	\N	USA	\N	\N	\N
63	zach-bogosian	Zach Bogosian	D	20	8474567	24	\N	\N	\N	1990-07-15	Massena, New York, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8474567.png	R	231	\N	USA	\N	\N	\N
68	daemon-hunt	Daemon Hunt	D	20	8482094	48	\N	\N	\N	2002-05-15	Brandon, Manitoba, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482094.png	L	193	\N	CAN	\N	\N	\N
77	jesper-wallstedt	Jesper Wallstedt	G	20	8482661	30	\N	\N	\N	2002-11-14	Vasteras, SWE	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482661.png	L	214	\N	SWE	\N	\N	\N
85	ivan-demidov	Ivan Demidov	R	21	8484984	93	\N	\N	\N	2005-12-10	Sergiyev Posad, RUS	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484984.png	L	192	\N	RUS	\N	\N	\N
93	alexandre-carrier	Alexandre Carrier	D	21	8478851	45	\N	\N	\N	1996-10-08	Quebec City, Quebec, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478851.png	R	174	\N	CAN	\N	\N	\N
105	samuel-montembeault	Samuel Montembeault	G	21	8478470	35	\N	\N	\N	1996-10-30	Becancour, Quebec, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478470.png	L	218	\N	CAN	\N	\N	\N
115	jonathan-marchessault	Jonathan Marchessault	C	22	8476539	81	\N	\N	\N	1990-12-27	Cap-Rouge, Quebec, CAN	5'9"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476539.png	R	185	\N	CAN	\N	\N	\N
123	ilya-lyubushkin	Ilya Lyubushkin	D	22	8480950	\N	\N	\N	\N	1994-04-06	Moscow, RUS	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480950.png	R	206	\N	RUS	\N	\N	\N
132	connor-brown	Connor Brown	R	23	8477015	16	\N	\N	\N	1994-01-14	Toronto, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477015.png	R	184	\N	CAN	\N	\N	\N
141	evan-rodrigues	Evan Rodrigues	C	23	8478542	\N	\N	\N	\N	1993-07-28	Toronto, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478542.png	R	182	\N	CAN	\N	\N	\N
145	luke-hughes	Luke Hughes	D	23	8482684	43	\N	\N	\N	2003-09-09	Manchester, New Hampshire, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482684.png	L	198	\N	USA	\N	\N	\N
153	anthony-duclair	Anthony Duclair	L	24	8477407	11	\N	\N	\N	1995-08-26	Pointe-Claire, Quebec, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477407.png	L	198	\N	CAN	\N	\N	\N
162	brayden-schenn	Brayden Schenn	C	24	8475170	10	\N	\N	\N	1991-08-22	Saskatoon, Saskatchewan, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475170.png	L	200	\N	CAN	\N	\N	\N
9	mathieu-joseph	Mathieu Joseph	F	319	8478472	21	\N	\N	\N	1997-02-09	Laval, Quebec, CAN	6'1	https://assets.nhle.com/mugs/nhl/latest/168x168/8478472.png	L	189	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6791	6791	jamie-drysdale
395	daniil-but	Daniil But	F	323	8484388	19	\N	\N	\N	2005-02-15	Yaroslavl, RUS	6'5	https://assets.nhle.com/mugs/nhl/latest/168x168/8484388.png	R	203	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10664	10664	jamie-drysdale
18	shakir-mukhamadullin	Shakir Mukhamadullin	D	1	8482166	85	\N	\N	\N	2002-01-10	Ufa, RUS	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482166.png	L	200	\N	RUS	\N	\N	\N
522	nathan-gaucher	Nathan Gaucher	C	317	8483444	41	\N	\N	\N	2003-11-06	Chambly, Quebec, CAN	6'3	https://assets.nhle.com/mugs/nhl/latest/168x168/8483444.png	R	226	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9185	9185	jamie-drysdale
179	alexis-lafrenire	Alexis Lafrenière	L	25	8482109	13	\N	\N	\N	2001-10-11	St-Eustache, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482109.png	L	191	\N	CAN	\N	\N	\N
188	drew-fortescue	Drew Fortescue	D	25	8484169	45	\N	\N	\N	2005-04-28	New York, New York, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484169.png	L	195	\N	USA	\N	\N	\N
198	igor-shesterkin	Igor Shesterkin	G	25	8478048	31	\N	\N	\N	1995-12-30	Moscow, RUS	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478048.png	L	199	\N	RUS	\N	\N	\N
207	claude-giroux	Claude Giroux	R	26	8473512	28	\N	\N	\N	1988-01-12	Hearst, Ontario, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8473512.png	R	186	\N	CAN	\N	\N	\N
213	shane-pinto	Shane Pinto	C	26	8481596	12	\N	\N	\N	2000-11-12	Franklin Square, New York, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481596.png	R	206	\N	USA	\N	\N	\N
221	jordan-spence	Jordan Spence	D	26	8481606	10	\N	\N	\N	2001-02-24	Manly, AUS	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481606.png	R	188	\N	AUS	\N	\N	\N
230	noah-cates	Noah Cates	L	27	8480220	27	\N	\N	\N	1999-02-05	Stillwater, Minnesota, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480220.png	L	194	\N	USA	\N	\N	\N
240	matvei-michkov	Matvei Michkov	R	27	8484387	39	\N	\N	\N	2004-12-09	Perm, RUS	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484387.png	L	172	\N	RUS	\N	\N	\N
250	travis-sanheim	Travis Sanheim	D	27	8477948	6	\N	\N	\N	1996-03-29	Elkhorn, Manitoba, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477948.png	L	222	\N	CAN	\N	\N	\N
258	egor-chinakhov	Egor Chinakhov	R	28	8482475	59	\N	\N	\N	2001-02-01	Omsk, RUS	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482475.png	L	203	\N	RUS	\N	\N	\N
264	blake-lizotte	Blake Lizotte	C	28	8481481	46	\N	\N	\N	1997-12-13	Lindstrom, Minnesota, USA	5'9"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481481.png	L	176	\N	USA	\N	\N	\N
272	samuel-girard	Samuel Girard	D	28	8479398	49	\N	\N	\N	1998-05-12	Roberval, Quebec, CAN	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479398.png	L	170	\N	CAN	\N	\N	\N
280	macklin-celebrini	Macklin Celebrini	C	29	8484801	71	\N	\N	\N	2006-06-13	North Vancouver, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484801.png	L	190	\N	CAN	\N	\N	\N
289	will-smith	Will Smith	C	29	8484227	2	\N	\N	\N	2005-03-17	Boston, Massachusetts, USA	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484227.png	R	180	\N	USA	\N	\N	\N
297	yaroslav-askarov	Yaroslav Askarov	G	29	8482137	30	\N	\N	\N	2002-06-16	Omsk, RUS	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482137.png	R	180	\N	RUS	\N	\N	\N
305	jared-mccann	Jared McCann	L	30	8477955	19	\N	\N	\N	1996-05-31	Stratford, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477955.png	L	191	\N	CAN	\N	\N	\N
314	cale-fleury	Cale Fleury	D	30	8479985	8	\N	\N	\N	1998-11-19	Carlyle, Saskatchewan, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479985.png	R	204	\N	CAN	\N	\N	\N
322	pavel-buchnevich	Pavel Buchnevich	L	31	8477402	89	\N	\N	\N	1995-04-17	Cherepovets, RUS	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477402.png	L	196	\N	RUS	\N	\N	\N
329	jake-neighbours	Jake Neighbours	L	31	8482089	63	\N	\N	\N	2002-03-29	Calgary, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482089.png	L	201	\N	CAN	\N	\N	\N
337	brandon-carlo	Brandon Carlo	D	31	8478443	\N	\N	\N	\N	1996-11-26	Colorado Springs, Colorado, USA	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478443.png	R	227	\N	USA	\N	\N	\N
346	zemgus-girgensons	Zemgus Girgensons	C	32	8476878	28	\N	\N	\N	1994-01-05	Riga, LVA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476878.png	L	197	\N	LVA	\N	\N	\N
239	porter-martone	Porter Martone	R	27	8485406	94	\N	\N	\N	2006-10-26	Peterborough, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8485406.png	R	214	\N	CAN	\N	\N	\N
406	liam-obrien	Liam O'Brien	C	34	8477070	38	\N	\N	\N	1994-07-29	Halifax, Nova Scotia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477070.png	L	215	\N	CAN	\N	\N	\N
424	paul-cotter	Paul Cotter	C	35	8481032	\N	\N	\N	\N	1999-11-16	Canton, Michigan, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481032.png	L	213	\N	USA	\N	\N	\N
426	brendan-gallagher	Brendan Gallagher	R	35	8475848	\N	\N	\N	\N	1992-05-06	Edmonton, Alberta, CAN	5'9"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475848.png	R	185	\N	CAN	\N	\N	\N
428	drew-oconnor	Drew O'Connor	L	35	8482055	18	\N	\N	\N	1998-06-09	Chatham, New Jersey, USA	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482055.png	L	209	\N	USA	\N	\N	\N
447	nic-dowd	Nic Dowd	C	36	8475343	26	\N	\N	\N	1990-05-27	Huntsville, Alabama, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475343.png	R	195	\N	USA	\N	\N	\N
371	max-domi	Max Domi	C	2	8477503	11	\N	\N	\N	1995-03-02	Winnipeg, Manitoba, CAN	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477503.png	L	208	\N	CAN	\N	\N	\N
380	william-nylander	William Nylander	R	2	8477939	88	\N	\N	\N	1996-05-01	Calgary, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477939.png	R	200	\N	CAN	\N	\N	\N
388	philippe-myers	Philippe Myers	D	2	8479026	51	\N	\N	\N	1997-01-25	Moncton, New Brunswick, CAN	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479026.png	R	221	\N	CAN	\N	\N	\N
530	nico-myatovic	Nico Myatovic	L	317	8484201	48	\N	\N	\N	2004-12-01	Prince George, British Columbia, CAN	6'2	https://assets.nhle.com/mugs/nhl/latest/168x168/8484201.png	L	203	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10076	10076	jamie-drysdale
489	vincent-desharnais	Vincent Desharnais	D	37	8479576	73	\N	\N	\N	1996-05-29	Laval, Quebec, CAN	6'7"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479576.png	R	225	\N	CAN	\N	\N	\N
497	clay-stevenson	Clay Stevenson	G	37	8483532	33	\N	\N	\N	1999-03-03	Drayton Valley, Alberta, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8483532.png	L	195	\N	CAN	\N	\N	\N
440	tom-willander	Tom Willander	D	295	8484240	5	\N	\N	\N	2005-02-09	Stockholm, SWE	6'1	https://assets.nhle.com/mugs/nhl/latest/168x168/8484240.png	R	180	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10751	10751	jamie-drysdale
365	ryan-mcdonagh	Ryan McDonagh	D	32	8474151	27	\N	\N	\N	1989-06-13	St. Paul, Minnesota, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8474151.png	L	216	\N	USA	\N	\N	\N
471	carter-hart	Carter Hart	G	36	8479394	79	\N	\N	\N	1998-08-13	Sherwood Park, Alberta, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479394.png	L	196	\N	CAN	\N	\N	\N
529	jeff-malott	Jeff Malott	L	7	8482408	\N	\N	\N	\N	1996-08-07	Burlington, Ontario, CAN	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482408.png	L	215	\N	CAN	\N	\N	\N
248	hunter-mcdonald	Hunter Mcdonald	D	310	8483760	75	\N	\N	\N	2002-05-11	Fairport, New York, USA	6'4	https://assets.nhle.com/mugs/nhl/latest/168x168/8483760.png	L	238	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10046	10046	jamie-drysdale
537	drew-helleson	Drew Helleson	D	7	8481563	14	\N	\N	\N	2001-03-26	Farmington, Minnesota, USA	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481563.png	R	208	\N	USA	\N	\N	\N
547	laurent-brossoit	Laurent Brossoit	G	7	8476316	\N	\N	\N	\N	1993-03-23	Port Alberni, British Columbia, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476316.png	L	203	\N	CAN	\N	\N	\N
556	sean-kuraly	Sean Kuraly	C	3	8476374	52	\N	\N	\N	1993-01-20	Niagara Falls, New York, USA	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476374.png	L	208	\N	USA	\N	\N	\N
570	mason-lohrei	Mason Lohrei	D	3	8482511	6	\N	\N	\N	2001-01-17	Baton Rouge, Louisiana, USA	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482511.png	L	218	\N	USA	\N	\N	\N
580	tyson-kozak	Tyson Kozak	C	9	8482896	48	\N	\N	\N	2002-12-29	Souris, Manitoba, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482896.png	L	185	\N	CAN	\N	\N	\N
589	tage-thompson	Tage Thompson	C	9	8479420	72	\N	\N	\N	1997-10-30	Phoenix, Arizona, USA	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479420.png	R	220	\N	USA	\N	\N	\N
599	mattias-samuelsson	Mattias Samuelsson	D	9	8480807	23	\N	\N	\N	2000-03-14	Philadelphia, Pennsylvania, USA	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480807.png	L	229	\N	USA	\N	\N	\N
606	mikael-backlund	Mikael Backlund	C	10	8474150	11	\N	\N	\N	1989-03-17	Vasteras, SWE	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8474150.png	L	206	\N	SWE	\N	\N	\N
623	kevin-bahl	Kevin Bahl	D	10	8480860	7	\N	\N	\N	2000-06-27	New Westminster, British Columbia, CAN	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480860.png	L	230	\N	CAN	\N	\N	\N
629	brayden-pachal	Brayden Pachal	D	10	8481167	94	\N	\N	\N	1999-08-23	Estevan, Saskatchewan, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481167.png	R	202	\N	CAN	\N	\N	\N
637	william-carrier	William Carrier	L	11	8477478	28	\N	\N	\N	1994-12-20	LaSalle, Quebec, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477478.png	L	214	\N	CAN	\N	\N	\N
647	logan-stankoven	Logan Stankoven	C	11	8482702	22	\N	\N	\N	2003-02-26	Kamloops, British Columbia, CAN	5'8"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482702.png	R	165	\N	CAN	\N	\N	\N
658	tyler-bertuzzi	Tyler Bertuzzi	L	12	8477479	59	\N	\N	\N	1995-02-24	Sudbury, Ontario, CAN	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477479.png	L	200	\N	CAN	\N	\N	\N
663	jordan-greenway	Jordan Greenway	L	12	8478413	\N	\N	\N	\N	1997-02-16	Canton, New York, USA	6'6"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478413.png	L	231	\N	USA	\N	\N	\N
672	bowen-byram	Bowen Byram	D	12	8481524	\N	\N	\N	\N	2001-06-13	Cranbrook, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481524.png	L	205	\N	CAN	\N	\N	\N
690	brock-nelson	Brock Nelson	C	13	8475754	11	\N	\N	\N	1991-10-15	Warroad, Minnesota, USA	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475754.png	L	205	\N	USA	\N	\N	\N
699	sam-malinski	Sam Malinski	D	13	8484258	70	\N	\N	\N	1998-07-27	Lakeville, Minnesota, USA	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484258.png	R	190	\N	USA	\N	\N	\N
708	ryan-lomberg	Ryan Lomberg	L	14	8479066	94	\N	\N	\N	1994-12-09	Richmond Hill, Ontario, CAN	5'9"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479066.png	L	184	\N	CAN	\N	\N	\N
718	dante-fabbro	Dante Fabbro	D	14	8479371	15	\N	\N	\N	1998-06-20	Coquitlam, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479371.png	R	200	\N	CAN	\N	\N	\N
726	jamie-benn	Jamie Benn	L	15	8473994	14	\N	\N	\N	1989-07-18	Victoria, British Columbia, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8473994.png	L	210	\N	CAN	\N	\N	\N
732	justin-hryckowian	Justin Hryckowian	C	15	8484829	49	\N	\N	\N	2001-02-23	L'Ile-Bizard, Quebec, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484829.png	L	198	\N	CAN	\N	\N	\N
744	esa-lindell	Esa Lindell	D	15	8476902	23	\N	\N	\N	1994-05-23	Vantaa, FIN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476902.png	L	217	\N	FIN	\N	\N	\N
746	tyler-myers	Tyler Myers	D	15	8474574	57	\N	\N	\N	1990-02-01	Houston, Texas, USA	6'8"	https://assets.nhle.com/mugs/nhl/latest/168x168/8474574.png	R	229	\N	USA	\N	\N	\N
754	emmitt-finnie	Emmitt Finnie	C	16	8484471	58	\N	\N	\N	2005-06-27	Lethbridge, Alberta, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8484471.png	L	195	\N	CAN	\N	\N	\N
762	ben-chiarot	Ben Chiarot	D	16	8475279	8	\N	\N	\N	1991-05-09	Hamilton, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475279.png	L	222	\N	CAN	\N	\N	\N
801	eetu-luostarinen	Eetu Luostarinen	C	18	8480185	27	\N	\N	\N	1998-09-02	Siilinjarvi, FIN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480185.png	L	191	\N	FIN	\N	\N	\N
810	aaron-ekblad	Aaron Ekblad	D	18	8477932	5	\N	\N	\N	1996-02-07	Windsor, Ontario, CAN	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477932.png	R	220	\N	CAN	\N	\N	\N
816	alexander-petrovic	Alexander Petrovic	D	18	8475755	36	\N	\N	\N	1992-03-03	Edmonton, Alberta, CAN	6'5"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475755.png	R	215	\N	CAN	\N	\N	\N
254	aleksei-kolosov	Aleksei Kolosov	G	27	8482783	35	\N	\N	\N	2002-01-04	Minsk, BLR	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482783.png	L	185	\N	BLR	\N	\N	\N
291	alexander-wennberg	Alexander Wennberg	C	29	8477505	21	\N	\N	\N	1994-09-22	Stockholm, SWE	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477505.png	L	190	\N	SWE	\N	\N	\N
706	conor-garland	Conor Garland	R	14	8478856	83	\N	\N	\N	1996-03-11	Scituate, Massachusetts, USA	5'10"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478856.png	R	165	\N	USA	\N	\N	\N
473	carl-lindbom	Carl Lindbom	G	36	8482761	30	\N	\N	\N	2003-05-20	Stockholm, SWE	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8482761.png	L	186	\N	SWE	\N	\N	\N
518	connor-hellebuyck	Connor Hellebuyck	G	38	8476945	37	\N	\N	\N	1993-05-19	Commerce, Michigan, USA	6'4"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476945.png	L	207	\N	USA	\N	\N	\N
594	ryan-johnson	Ryan Johnson	D	315	8481564	33	\N	\N	\N	2001-07-24	Newport Beach, California, USA	6'1	https://assets.nhle.com/mugs/nhl/latest/168x168/8481564.png	L	195	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9767	9767	jamie-drysdale
506	nino-niederreiter	Nino Niederreiter	R	38	8475799	62	\N	\N	\N	1992-09-08	Chur, CHE	6'2"	https://assets.nhle.com/mugs/nhl/latest/168x168/8475799.png	L	218	\N	CHE	\N	\N	\N
514	josh-morrissey	Josh Morrissey	D	38	8477504	44	\N	\N	\N	1995-03-28	Calgary, Alberta, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477504.png	L	195	\N	CAN	\N	\N	\N
5215	jamieson-rees	Jamieson Rees	L	297	\N	\N	\N	\N	\N	2001-02-26	\N	5.10	\N	L	186	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8442	8442	jamie-drysdale
5187	riley-duran	Riley Duran	R	314	\N	\N	\N	\N	\N	2002-01-25	\N	6'2	\N	R	198	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10055	10055	jamie-drysdale
5190	william-wallinder	William Wallinder	D	304	\N	\N	\N	\N	\N	2002-07-28	\N	6'4	\N	L	208	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9672	9672	jamie-drysdale
5192	connor-mackey	Connor Mackey	D	305	\N	\N	\N	\N	\N	1996-09-12	\N	6'3	\N	L	205	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8622	8622	jamie-drysdale
5197	hunter-skinner	Hunter Skinner	D	319	\N	\N	\N	\N	\N	2001-04-29	\N	6'3	\N	R	195	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8630	8630	jamie-drysdale
5200	jeremie-poirier	Jeremie Poirier	D	321	\N	\N	\N	\N	\N	2002-06-02	\N	6'1	\N	L	196	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9447	9447	jamie-drysdale
5202	john-farinacci	John Farinacci	C	314	\N	\N	\N	\N	\N	2001-02-14	\N	6'0	\N	R	184	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9831	9831	jamie-drysdale
5203	jordan-dumais	Jordan Dumais	R	301	\N	\N	\N	\N	\N	2004-04-15	\N	5'8	\N	R	173	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10488	10488	jamie-drysdale
5221	noah-gregor	Noah Gregor	C	299	\N	\N	\N	\N	\N	1998-07-28	\N	6'0	\N	L	201	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7149	7149	jamie-drysdale
5223	riley-stillman	Riley Stillman	D	296	\N	\N	\N	\N	\N	1998-03-09	\N	6'2	\N	L	207	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7352	7352	jamie-drysdale
5225	ronnie-attard	Ronnie Attard	D	303	\N	\N	\N	\N	\N	1999-03-20	\N	6'3	\N	R	208	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9571	9571	jamie-drysdale
5226	anthony-vincent	Anthony Vincent	F	318	\N	\N	\N	\N	\N	1997-08-12	\N	6'0	\N	R	190	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9621	9621	jamie-drysdale
5228	austin-strand	Austin Strand	D	324	\N	\N	\N	\N	\N	1997-02-17	\N	6'3	\N	R	215	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7117	7117	jamie-drysdale
5230	carter-mazur	Carter Mazur	R	304	\N	\N	\N	\N	\N	2002-03-28	\N	6'0	\N	R	200	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9661	9661	jamie-drysdale
5233	logan-brown	Logan Brown	F	313	\N	\N	\N	\N	\N	1998-03-05	\N	6'7	\N	L	229	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7362	7362	jamie-drysdale
5242	ville-ottavainen	Ville Ottavainen	D	302	\N	\N	\N	\N	\N	2002-08-12	\N	6'5	\N	R	210	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9706	9706	jamie-drysdale
5247	dmitry-kuzmin	Dmitry Kuzmin	D	316	\N	\N	\N	\N	\N	2003-04-23	\N	5'10	\N	L	188	\N	BLR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9739	9739	jamie-drysdale
5249	garrett-wilson	Garrett Wilson	L	310	\N	\N	\N	\N	\N	1991-03-16	\N	6'3	\N	L	218	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4334	4334	jamie-drysdale
5251	joe-fleming	Joe Fleming	F	306	\N	\N	\N	\N	\N	2003-06-19	\N	6'1	\N	R	211	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9279	9279	jamie-drysdale
5254	matt-benning	Matt Benning	D	322	\N	\N	\N	\N	\N	1994-05-25	\N	6'1	\N	R	220	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6510	6510	jamie-drysdale
5257	nikita-nesterenko	Nikita Nesterenko	L	317	\N	\N	\N	\N	\N	2001-09-10	\N	6'2	\N	L	203	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9778	9778	jamie-drysdale
5266	carter-king	Carter King	C	298	\N	\N	\N	\N	\N	2001-08-30	\N	5'11	\N	L	190	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10626	10626	jamie-drysdale
5269	justin-holl	Justin Holl	D	304	\N	\N	\N	\N	\N	1992-01-30	\N	6'4	\N	R	194	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5824	5824	jamie-drysdale
5271	luke-tuch	Luke Tuch	L	309	\N	\N	\N	\N	\N	2002-03-07	\N	6'3	\N	L	215	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10149	10149	jamie-drysdale
5273	ryan-mast	Ryan Mast	D	316	\N	\N	\N	\N	\N	2003-01-14	\N	6'5	\N	R	221	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9827	9827	jamie-drysdale
5274	ryder-rolston	Ryder Rolston	F	312	\N	\N	\N	\N	\N	2001-10-31	\N	6'1	\N	R	175	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9622	9622	jamie-drysdale
5259	reese-johnson	Reese Johnson	R	322	\N	\N	\N	\N	\N	1998-07-10	\N	6.01	\N	R	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7579	7579	jamie-drysdale
5211	dylan-anhorn	Dylan Anhorn	D	311	\N	\N	\N	\N	\N	1999-01-21	\N	6.00	\N	L	192	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10112	10112	jamie-drysdale
5121	kevin-lombardi	Kevin Lombardi	F	316	\N	\N	\N	\N	\N	1998-08-12	\N	6.05	\N	R	229	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10033	10033	jamie-drysdale
5262	alex-doucet	Alex Doucet	L	304	\N	\N	\N	\N	\N	2002-01-12	\N	6.00	\N	L	195	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10008	10008	jamie-drysdale
11	ryan-nugent-hopkins	Ryan Nugent-Hopkins	C	1	8476454	93	\N	\N	\N	1993-04-12	Burnaby, British Columbia, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8476454.png	L	192	\N	CAN	\N	\N	\N
5119	jake-schmaltz	Jake Schmaltz	C	314	\N	\N	\N	\N	\N	2001-04-24	\N	6.02	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10541	10541	jamie-drysdale
59	maksim-shabanov	Maksim Shabanov	R	20	8485702	49	\N	\N	\N	2000-10-07	Chelyabinsk, RUS	5'9"	https://assets.nhle.com/mugs/nhl/latest/168x168/8485702.png	L	167	\N	RUS	\N	\N	\N
114	alexander-kerfoot	Alexander Kerfoot	C	22	8477021	\N	\N	\N	\N	1994-08-11	Vancouver, British Columbia, CAN	5'11"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477021.png	L	185	\N	CAN	\N	\N	\N
176	pavel-dorofeyev	Pavel Dorofeyev	R	25	8481604	16	\N	\N	\N	2000-10-26	Nizhny Tagil, RUS	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481604.png	L	194	\N	RUS	\N	\N	\N
333	robert-thomas	Robert Thomas	C	31	8480023	18	\N	\N	\N	1999-07-02	Aurora, Ontario, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480023.png	R	207	\N	CAN	\N	\N	\N
584	ryan-mcleod	Ryan McLeod	C	9	8480802	71	\N	\N	\N	1999-09-21	Mississauga, Ontario, CAN	6'3"	https://assets.nhle.com/mugs/nhl/latest/168x168/8480802.png	L	204	\N	CAN	\N	\N	\N
688	nathan-mackinnon	Nathan MacKinnon	C	13	8477492	29	\N	\N	\N	1995-09-01	Halifax, Nova Scotia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8477492.png	R	200	\N	CAN	\N	\N	\N
717	jake-christiansen	Jake Christiansen	D	14	8481161	2	\N	\N	\N	1999-09-12	West Vancouver, British Columbia, CAN	6'0"	https://assets.nhle.com/mugs/nhl/latest/168x168/8481161.png	L	199	\N	CAN	\N	\N	\N
4842	jack-ahcan	Jack Ahcan	D	303	\N	\N	\N	\N	\N	1997-05-18	\N	5'8	\N	L	180	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8500	8500	jamie-drysdale
4844	matthew-phillips	Matthew Phillips	R	317	\N	\N	\N	\N	\N	1998-04-06	\N	5'8	\N	R	160	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6729	6729	jamie-drysdale
4846	nick-abruzzese	Nick Abruzzese	L	320	\N	\N	\N	\N	\N	1999-06-04	\N	5'10	\N	L	178	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9563	9563	jamie-drysdale
4850	jake-lucchini	Jake Lucchini	C	312	\N	\N	\N	\N	\N	1995-05-09	\N	6'0	\N	L	180	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7512	7512	jamie-drysdale
4862	ben-steeves	Ben Steeves	F	299	\N	\N	\N	\N	\N	2002-05-10	\N	5'8	\N	L	165	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10056	10056	jamie-drysdale
4864	jimmy-huntington	Jimmy Huntington	F	318	\N	\N	\N	\N	\N	1998-11-18	\N	6'0	\N	L	200	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7897	7897	jamie-drysdale
4866	ryan-suzuki	Ryan Suzuki	C	300	\N	\N	\N	\N	\N	2001-05-28	\N	6'1	\N	L	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8437	8437	jamie-drysdale
4868	colin-white	Colin White	C	318	\N	\N	\N	\N	\N	1997-01-30	\N	6'1	https://www.hockeydb.com/ihdb/photos/colin-white-2008-51.jpg	R	195	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6669	6669	jamie-drysdale
4795	jakob-pelletier	Jakob Pelletier	L	320	\N	\N	\N	\N	\N	2001-03-07	\N	5'10	\N	L	172	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8744	8744	jamie-drysdale
4797	alex-barre-boulet	Alex Barre-boulet	C	303	\N	\N	\N	\N	\N	1997-05-21	\N	5'10	\N	L	178	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7345	7345	jamie-drysdale
4810	georgii-merkulov	Georgii Merkulov	L	314	\N	\N	\N	\N	\N	2000-10-10	\N	5'11	\N	L	174	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9108	9108	jamie-drysdale
4813	luca-del-bel-belluz	Luca Del Bel Belluz	F	301	\N	\N	\N	\N	\N	2003-11-10	\N	6'1	\N	L	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9981	9981	jamie-drysdale
4815	laurent-dauphin	Laurent Dauphin	F	309	\N	\N	\N	\N	\N	1995-03-27	\N	6'0	\N	L	186	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5927	5927	jamie-drysdale
4817	viljami-marjala	Viljami Marjala	C	296	\N	\N	\N	\N	\N	2003-01-29	\N	6'0	\N	L	178	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10876	10876	jamie-drysdale
4839	sean-farrell	Sean Farrell	F	309	\N	\N	\N	\N	\N	2001-11-02	\N	5'9	\N	L	182	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9791	9791	jamie-drysdale
4852	rem-pitlick	Rem Pitlick	L	316	\N	\N	\N	\N	\N	1997-04-02	\N	5'11	\N	L	186	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7927	7927	jamie-drysdale
4854	ben-hemmerling	Ben Hemmerling	F	306	\N	\N	\N	\N	\N	2004-04-21	\N	5'11	\N	R	177	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9272	9272	jamie-drysdale
4857	mikael-pyyhtia	Mikael Pyyhtia	L	301	\N	\N	\N	\N	\N	2001-12-17	\N	6'0	\N	L	178	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9634	9634	jamie-drysdale
4824	xavier-bourgault	Xavier Bourgault	R	297	\N	\N	\N	\N	\N	2002-10-22	\N	5'11	\N	R	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9448	9448	jamie-drysdale
4910	phil-tomasino	Phil Tomasino	R	310	\N	\N	\N	\N	\N	2001-07-28	\N	6.00	https://www.hockeydb.com/ihdb/photos/philip-tomasino-2026-50.jpg	R	187	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8559	8559	jamie-drysdale
4833	john-leonard	John Leonard	L	304	\N	\N	\N	\N	\N	1998-08-07	\N	5'11	\N	L	192	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8511	8511	jamie-drysdale
4883	brett-leason	Brett Leason	R	307	\N	\N	\N	\N	\N	1999-04-30	\N	6'5	\N	R	220	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7921	7921	jamie-drysdale
4889	graeme-clarke	Graeme Clarke	R	297	\N	\N	\N	\N	\N	2001-04-24	\N	6'0	\N	R	175	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8598	8598	jamie-drysdale
4892	mason-shaw	Mason Shaw	R	311	\N	\N	\N	\N	\N	1998-11-03	\N	5'10	\N	L	184	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7113	7113	jamie-drysdale
4895	amadeus-lombardi	Amadeus Lombardi	C	304	\N	\N	\N	\N	\N	2003-06-05	\N	5'11	\N	L	180	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9718	9718	jamie-drysdale
4897	eduards-tralmaks	Eduards Tralmaks	L	304	\N	\N	\N	\N	\N	1997-02-17	\N	6'3	\N	L	221	\N	LVA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8654	8654	jamie-drysdale
4900	vinni-lettieri	Vinni Lettieri	C	322	\N	\N	\N	\N	\N	1995-02-06	\N	5'10	\N	R	184	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6681	6681	jamie-drysdale
4903	justin-bailey	Justin Bailey	R	317	\N	\N	\N	\N	\N	1995-07-01	\N	6'4	\N	R	214	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6080	6080	jamie-drysdale
4906	atro-leppanen	Atro Leppanen	D	296	\N	\N	\N	\N	\N	1998-12-14	\N	6'0	\N	L	183	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10879	10879	jamie-drysdale
4908	egor-afanasyev	Egor Afanasyev	L	318	\N	\N	\N	\N	\N	2001-01-23	\N	6'4	\N	L	211	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8914	8914	jamie-drysdale
4913	xavier-parent	Xavier Parent	F	324	\N	\N	\N	\N	\N	2001-03-23	\N	5'8	https://www.hockeydb.com/ihdb/photos/xavier-parent-2026-9332.jpg	L	170	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9516	9516	jamie-drysdale
4916	artem-shlaine	Artem Shlaine	F	321	\N	\N	\N	\N	\N	2002-03-07	\N	6'1	\N	L	165	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10546	10546	jamie-drysdale
4837	cameron-hebig	Cameron Hebig	C	323	\N	\N	\N	\N	\N	1997-01-21	\N	5.10	\N	R	184	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7401	7401	jamie-drysdale
4870	roby-jarventie	Roby Jarventie	R	296	\N	\N	\N	\N	\N	2002-08-08	\N	6'2	\N	L	184	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8726	8726	jamie-drysdale
4804	quinn-hutson	Quinn Hutson	F	296	\N	\N	\N	\N	\N	2002-01-01	\N	5'11	\N	R	176	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10874	10874	jamie-drysdale
4819	dylan-duke	Dylan Duke	C	320	\N	\N	\N	\N	\N	2003-03-04	\N	5'10	\N	L	184	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10148	10148	jamie-drysdale
4836	alex-nylander	Alex Nylander	R	322	\N	\N	\N	\N	\N	1998-03-02	\N	6'1	\N	R	205	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6489	6489	jamie-drysdale
4828	riley-tufte	Riley Tufte	L	314	\N	\N	\N	\N	\N	1998-04-10	\N	6'6	\N	L	233	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7943	7943	jamie-drysdale
4934	ty-mueller	Ty Mueller	C	295	\N	\N	\N	\N	\N	2003-02-26	\N	5'11	\N	L	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10089	10089	jamie-drysdale
4944	jack-williams	Jack Williams	C	301	\N	\N	\N	\N	\N	2002-03-02	\N	5'11	\N	R	185	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10894	10894	jamie-drysdale
4946	jaret-anderson-dolan	Jaret Anderson-dolan	C	311	\N	\N	\N	\N	\N	1999-09-12	\N	5'11	\N	L	200	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7118	7118	jamie-drysdale
4948	trevor-kuntar	Trevor Kuntar	L	315	\N	\N	\N	\N	\N	2001-06-20	\N	6'0	\N	L	205	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9700	9700	jamie-drysdale
4954	juraj-pekarcik	Juraj Pekarcik	F	319	\N	\N	\N	\N	\N	2005-09-12	\N	6'2	\N	L	204	\N	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10839	10839	jamie-drysdale
4958	matyas-sapovaliv	Matyas Sapovaliv	F	306	\N	\N	\N	\N	\N	2004-02-12	\N	6'4	\N	L	204	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9274	9274	jamie-drysdale
4960	owen-sillinger	Owen Sillinger	C	301	\N	\N	\N	\N	\N	1997-09-23	\N	5'10	\N	L	182	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9058	9058	jamie-drysdale
4962	ty-nelson	Ty Nelson	D	302	\N	\N	\N	\N	\N	2004-03-30	\N	5'9	\N	R	195	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9764	9764	jamie-drysdale
4964	brian-halonen	Brian Halonen	F	324	\N	\N	\N	\N	\N	1999-01-11	\N	6'0	\N	R	207	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9067	9067	jamie-drysdale
4966	derrick-pouliot	Derrick Pouliot	D	316	\N	\N	\N	\N	\N	1994-01-16	\N	6'0	\N	L	198	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4957	4957	jamie-drysdale
4968	oscar-fisker-m-lgaard	OSCAR FISKER MøLGAARD	F	302	\N	\N	\N	\N	\N	2005-02-18	\N	6'0	\N	L	168	\N	DNK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10575	10575	jamie-drysdale
4971	walker-duehr	Walker Duehr	R	311	\N	\N	\N	\N	\N	1997-11-23	\N	6'2	\N	R	210	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8706	8706	jamie-drysdale
4977	noel-gunler	Noel Gunler	R	300	\N	\N	\N	\N	\N	2001-10-07	\N	6'2	\N	R	185	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9090	9090	jamie-drysdale
4980	danil-gushchin	Danil Gushchin	F	303	\N	\N	\N	\N	\N	2002-02-06	\N	5'8	\N	L	165	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9127	9127	jamie-drysdale
4983	harrison-scott	Harrison Scott	F	321	\N	\N	\N	\N	\N	2000-09-27	\N	6'0	\N	L	204	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10555	10555	jamie-drysdale
4986	robert-mastrosimone	Robert Mastrosimone	L	299	\N	\N	\N	\N	\N	2001-01-24	\N	5'10	\N	L	170	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9914	9914	jamie-drysdale
4988	wojciech-stachowiak	Wojciech Stachowiak	C	304	\N	\N	\N	\N	\N	1999-07-03	\N	6'1	\N	L	194	\N	POL	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10835	10835	jamie-drysdale
4990	carson-meyer	Carson Meyer	R	315	\N	\N	\N	\N	\N	1997-08-18	\N	5'11	\N	R	187	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8580	8580	jamie-drysdale
4992	daniel-carr	Daniel Carr	L	312	\N	\N	\N	\N	\N	1991-11-01	\N	6'0	\N	L	186	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5671	5671	jamie-drysdale
4875	william-stromgren	William Stromgren	L	298	\N	\N	\N	\N	\N	2003-06-07	\N	6'3	\N	L	175	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9669	9669	jamie-drysdale
4876	anthony-richard	Anthony Richard	L	310	\N	\N	\N	\N	\N	1996-12-20	\N	5'10	\N	L	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6342	6342	jamie-drysdale
4879	joshua-roy	Joshua Roy	L	309	\N	\N	\N	\N	\N	2003-08-06	\N	6'0	\N	L	192	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9182	9182	jamie-drysdale
5006	jared-wright	Jared Wright	F	313	\N	\N	\N	\N	\N	2002-11-22	\N	6'1	\N	R	178	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10623	10623	jamie-drysdale
5008	olle-lycksell	Olle Lycksell	R	297	\N	\N	\N	\N	\N	1999-08-24	\N	5'11	\N	L	197	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9485	9485	jamie-drysdale
5014	dysin-mayo	Dysin Mayo	D	301	\N	\N	\N	\N	\N	1996-08-17	\N	6'0	\N	R	190	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6322	6322	jamie-drysdale
5016	isaak-phillips	Isaak Phillips	D	311	\N	\N	\N	\N	\N	2001-09-28	\N	6'3	\N	L	205	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8424	8424	jamie-drysdale
5018	joakim-kemell	Joakim Kemell	F	312	\N	\N	\N	\N	\N	2004-04-27	\N	5'11	\N	R	182	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9631	9631	jamie-drysdale
5024	travis-boyd	Travis Boyd	F	322	\N	\N	\N	\N	\N	1993-09-14	\N	6'0	\N	R	190	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5918	5918	jamie-drysdale
5026	aatu-jamsen	Aatu Jamsen	F	313	\N	\N	\N	\N	\N	2002-07-22	\N	6'1	\N	L	154	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9241	9241	jamie-drysdale
5028	dans-locmelis	Dans Locmelis	C	314	\N	\N	\N	\N	\N	2004-01-21	\N	6'0	\N	L	179	\N	LVA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10574	10574	jamie-drysdale
5033	reid-schaefer	Reid Schaefer	L	312	\N	\N	\N	\N	\N	2003-09-21	\N	6'5	\N	L	226	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9876	9876	jamie-drysdale
5035	zach-l-heureux	Zach L'heureux	L	312	\N	\N	\N	\N	\N	2003-05-15	\N	5.11	\N	L	197	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9874	9874	jamie-drysdale
4940	cooper-marody	Cooper Marody	F	302	\N	\N	\N	\N	\N	1996-12-20	\N	6.00	\N	R	195	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7132	7132	jamie-drysdale
4918	daniil-miromanov	Daniil Miromanov	D	298	\N	\N	\N	\N	\N	1997-07-11	\N	6'4	\N	R	207	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8729	8729	jamie-drysdale
4930	dylan-gambrell	Dylan Gambrell	C	308	\N	\N	\N	\N	\N	1996-08-26	\N	6'0	\N	R	191	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7428	7428	jamie-drysdale
4933	sandis-vilmanis	Sandis Vilmanis	F	299	\N	\N	\N	\N	\N	2004-01-23	\N	6'1	\N	L	192	\N	LVA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10456	10456	jamie-drysdale
4919	dominik-shine	Dominik Shine	F	304	\N	\N	\N	\N	\N	1993-04-18	\N	5'11	\N	R	177	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6627	6627	jamie-drysdale
5031	nikita-pavlychev	Nikita Pavlychev	C	300	\N	\N	\N	\N	\N	1997-03-23	\N	6.01	\N	L	180	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8615	8615	jamie-drysdale
4928	cross-hanas	Cross Hanas	F	321	\N	\N	\N	\N	\N	2002-01-05	\N	6'1	\N	L	171	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9548	9548	jamie-drysdale
5053	eduard-sale	Eduard Sale	F	302	\N	\N	\N	\N	\N	2005-03-10	\N	6'2	\N	L	174	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10184	10184	jamie-drysdale
5064	matthew-barbolini	Matthew Barbolini	F	322	\N	\N	\N	\N	\N	2000-06-01	\N	6'2	\N	R	188	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10053	10053	jamie-drysdale
5067	parker-ford	Parker Ford	R	311	\N	\N	\N	\N	\N	2000-07-20	\N	5'9	\N	R	181	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9656	9656	jamie-drysdale
5069	samuel-savoie	Samuel Savoie	F	316	\N	\N	\N	\N	\N	2004-03-25	\N	5'10	\N	L	189	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10177	10177	jamie-drysdale
5073	boris-katchouk	Boris Katchouk	L	310	\N	\N	\N	\N	\N	1998-06-18	\N	6'2	\N	L	212	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6779	6779	jamie-drysdale
5076	dylan-roobroeck	Dylan Roobroeck	F	305	\N	\N	\N	\N	\N	2004-07-27	\N	6'7	\N	L	222	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10189	10189	jamie-drysdale
5078	jack-thompson	Jack Thompson	D	295	\N	\N	\N	\N	\N	2002-03-19	\N	6'1	\N	R	189	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8709	8709	jamie-drysdale
5081	josiah-slavin	Josiah Slavin	L	300	\N	\N	\N	\N	\N	1998-12-31	\N	6'3	\N	L	205	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8645	8645	jamie-drysdale
5085	lenni-hameenaho	Lenni Hameenaho	F	324	\N	\N	\N	\N	\N	2004-11-07	\N	6'1	\N	R	195	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10892	10892	jamie-drysdale
5087	riley-heidt	Riley Heidt	C	308	\N	\N	\N	\N	\N	2005-03-25	\N	5'10	\N	L	178	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10608	10608	jamie-drysdale
5089	trevor-carrick	Trevor Carrick	D	299	\N	\N	\N	\N	\N	1994-07-04	\N	6'2	\N	L	209	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5614	5614	jamie-drysdale
5091	arshdeep-bains	Arshdeep Bains	L	295	\N	\N	\N	\N	\N	2001-01-09	\N	6'0	\N	L	184	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9554	9554	jamie-drysdale
5094	corson-ceulemans	Corson Ceulemans	D	301	\N	\N	\N	\N	\N	2003-05-05	\N	6'2	\N	R	198	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9618	9618	jamie-drysdale
5096	dylan-peterson	Dylan Peterson	F	319	\N	\N	\N	\N	\N	2002-01-08	\N	6'4	\N	R	209	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10143	10143	jamie-drysdale
5100	karsen-dorwart	Karsen Dorwart	F	310	\N	\N	\N	\N	\N	2002-09-17	\N	6'1	\N	L	194	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10718	10718	jamie-drysdale
5107	taylor-makar	Taylor Makar	F	303	\N	\N	\N	\N	\N	2001-03-13	\N	6'3	\N	L	190	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10561	10561	jamie-drysdale
5109	tristan-bertucci	Tristan Bertucci	D	321	\N	\N	\N	\N	\N	2005-07-12	\N	6'2	\N	L	191	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10135	10135	jamie-drysdale
5111	brennan-othmann	Brennan Othmann	L	298	\N	\N	\N	\N	\N	2003-01-05	\N	6'0	\N	L	192	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9970	9970	jamie-drysdale
5004	brayden-yager	Brayden Yager	C	311	\N	\N	\N	\N	\N	2005-01-03	\N	5'11	\N	R	180	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10908	10908	jamie-drysdale
4996	jakub-brabenec	Jakub Brabenec	F	306	\N	\N	\N	\N	\N	2003-09-11	\N	6'1	\N	L	190	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9266	9266	jamie-drysdale
5000	oasiz-wiesblatt	Oasiz Wiesblatt	C	312	\N	\N	\N	\N	\N	2004-04-08	\N	5'7	\N	L	180	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10832	10832	jamie-drysdale
5123	rhett-pitlick	Rhett Pitlick	R	296	\N	\N	\N	\N	\N	2001-02-07	\N	5'10	\N	L	170	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10599	10599	jamie-drysdale
5125	shane-lachance	Shane Lachance	F	324	\N	\N	\N	\N	\N	2003-08-30	\N	6'4	\N	L	195	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10632	10632	jamie-drysdale
5130	aidan-thompson	Aidan Thompson	F	305	\N	\N	\N	\N	\N	2002-02-18	\N	5'11	\N	L	180	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10618	10618	jamie-drysdale
5132	ben-gleason	Ben Gleason	D	308	\N	\N	\N	\N	\N	1998-03-25	\N	6'1	\N	L	190	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7375	7375	jamie-drysdale
5133	cedric-pare	Cedric Pare	F	322	\N	\N	\N	\N	\N	1999-01-24	\N	6'3	\N	L	205	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7780	7780	jamie-drysdale
5137	jake-leschyshyn	Jake Leschyshyn	C	315	\N	\N	\N	\N	\N	1999-03-10	\N	5'11	\N	L	196	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7622	7622	jamie-drysdale
5277	theo-lindstein	Theo Lindstein	D	319	\N	\N	\N	\N	\N	2005-01-05	\N	6'0	\N	L	197	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10920	10920	jamie-drysdale
5279	alex-gagne	Alex Gagne	D	303	\N	\N	\N	\N	\N	2002-08-12	\N	6'4	\N	L	205	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10654	10654	jamie-drysdale
5282	artem-duda	Artem Duda	D	323	\N	\N	\N	\N	\N	2004-04-08	\N	6'1	\N	L	187	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10218	10218	jamie-drysdale
5139	joey-abate	Joey Abate	L	314	\N	\N	\N	\N	\N	1998-09-26	\N	6.01	\N	L	196	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9435	9435	jamie-drysdale
5036	clark-bishop	Clark Bishop	C	298	\N	\N	\N	\N	\N	1996-03-29	\N	6'1	\N	L	197	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6453	6453	jamie-drysdale
5040	ian-mitchell	Ian Mitchell	D	320	\N	\N	\N	\N	\N	1999-01-18	\N	5'11	\N	R	198	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8667	8667	jamie-drysdale
5042	marc-del-gaizo	Marc Del Gaizo	D	309	\N	\N	\N	\N	\N	1999-10-11	\N	5'11	\N	L	188	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8717	8717	jamie-drysdale
5058	jagger-joshua	Jagger Joshua	L	315	\N	\N	\N	\N	\N	1999-03-29	\N	6.03	\N	L	218	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9643	9643	jamie-drysdale
5045	topias-vilen	Topias Vilen	D	324	\N	\N	\N	\N	\N	2003-04-01	\N	6'1	\N	L	194	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9758	9758	jamie-drysdale
5060	jonathan-gruden	Jonathan Gruden	C	324	\N	\N	\N	\N	\N	2000-05-04	\N	6'0	\N	L	192	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7608	7608	jamie-drysdale
5098	jean-luc-foudy	Jean-luc Foudy	R	308	\N	\N	\N	\N	\N	2002-05-13	\N	5.11	\N	R	177	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8576	8576	jamie-drysdale
4885	michael-brandsegg-nygard	Michael Brandsegg-nygard	R	304	\N	\N	\N	\N	\N	2005-10-05	\N	6'1	\N	R	204	\N	NOR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10629	10629	jamie-drysdale
5400	kyle-looft	Kyle Looft	D	321	\N	\N	\N	\N	\N	1998-06-27	\N	6.04	\N	L	216	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10147	10147	jamie-drysdale
5339	nate-clurman	Nate Clurman	D	309	\N	\N	\N	\N	\N	1998-05-08	\N	6.02	\N	R	202	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8689	8689	jamie-drysdale
5344	tate-singleton	Tate Singleton	R	301	\N	\N	\N	\N	\N	1998-09-05	\N	5.09	\N	L	176	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9904	9904	jamie-drysdale
5293	mark-senden	Mark Senden	F	303	\N	\N	\N	\N	\N	1998-01-22	\N	5'10	\N	L	201	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9638	9638	jamie-drysdale
5294	mathieu-cataford	Mathieu Cataford	F	306	\N	\N	\N	\N	\N	2005-03-01	\N	6'0	\N	R	200	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10131	10131	jamie-drysdale
5299	braden-hache	Braden Hache	D	318	\N	\N	\N	\N	\N	2003-05-21	\N	6'4	\N	L	200	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9177	9177	jamie-drysdale
5300	bradley-marek	Bradley Marek	F	308	\N	\N	\N	\N	\N	2000-11-13	\N	6'3	\N	L	212	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9799	9799	jamie-drysdale
5302	chase-bradley	Chase Bradley	F	303	\N	\N	\N	\N	\N	2002-01-09	\N	5'11	\N	L	180	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10249	10249	jamie-drysdale
5309	marek-alscher	Marek Alscher	D	299	\N	\N	\N	\N	\N	2004-04-07	\N	6'3	\N	L	206	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9745	9745	jamie-drysdale
5312	nikita-prishchepov	Nikita Prishchepov	F	303	\N	\N	\N	\N	\N	2004-02-20	\N	6'1	\N	L	194	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10257	10257	jamie-drysdale
5314	ryan-mcgregor	Ryan Mcgregor	C	323	\N	\N	\N	\N	\N	1999-01-29	\N	6'0	\N	L	168	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7581	7581	jamie-drysdale
5315	spencer-smallman	Spencer Smallman	C	307	\N	\N	\N	\N	\N	1996-09-09	\N	6'1	\N	R	205	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6910	6910	jamie-drysdale
5320	alec-regula	Alec Regula	D	296	\N	\N	\N	\N	\N	2000-08-06	\N	6'4	\N	R	211	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7663	7663	jamie-drysdale
5322	brandon-scanlin	Brandon Scanlin	D	305	\N	\N	\N	\N	\N	1999-06-02	\N	6'4	\N	L	222	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9048	9048	jamie-drysdale
5327	gleb-trikozov	Gleb Trikozov	L	300	\N	\N	\N	\N	\N	2004-08-12	\N	6'2	\N	R	201	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10466	10466	jamie-drysdale
5330	kevin-gravel	Kevin Gravel	D	312	\N	\N	\N	\N	\N	1992-03-06	\N	6'4	\N	L	205	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5529	5529	jamie-drysdale
5337	michael-pezzetta	Michael Pezzetta	L	322	\N	\N	\N	\N	\N	1998-03-13	\N	6'1	\N	L	222	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7383	7383	jamie-drysdale
5342	samuel-johannesson	Samuel Johannesson	D	319	\N	\N	\N	\N	\N	2000-12-27	\N	5'11	\N	R	184	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10331	10331	jamie-drysdale
5347	beau-akey	Beau Akey	D	296	\N	\N	\N	\N	\N	2005-02-11	\N	6'0	\N	R	173	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10880	10880	jamie-drysdale
5350	david-goyette	David Goyette	F	302	\N	\N	\N	\N	\N	2004-03-27	\N	5'10	\N	L	172	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9710	9710	jamie-drysdale
5241	viliam-kmec	Viliam Kmec	D	306	\N	\N	\N	\N	\N	2004-01-02	\N	6'2	\N	R	206	\N	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10285	10285	jamie-drysdale
5237	michael-callahan	Michael Callahan	D	314	\N	\N	\N	\N	\N	1999-09-23	\N	6'2	\N	L	195	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9032	9032	jamie-drysdale
5239	ryan-chesley	Ryan Chesley	D	307	\N	\N	\N	\N	\N	2004-02-27	\N	6'0	\N	R	195	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10572	10572	jamie-drysdale
5366	samu-tuomaala	Samu Tuomaala	F	321	\N	\N	\N	\N	\N	2003-01-08	\N	5'10	\N	R	174	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8777	8777	jamie-drysdale
5376	jack-malone	Jack Malone	F	324	\N	\N	\N	\N	\N	2000-10-13	\N	6'1	\N	R	191	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10158	10158	jamie-drysdale
5381	matteo-costantini	Matteo Costantini	C	315	\N	\N	\N	\N	\N	2002-08-16	\N	6'0	\N	L	194	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10930	10930	jamie-drysdale
5385	vilmer-alriksson	Vilmer Alriksson	L	295	\N	\N	\N	\N	\N	2005-02-18	\N	6'6	\N	L	214	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10117	10117	jamie-drysdale
5387	adam-ginning	Adam Ginning	D	310	\N	\N	\N	\N	\N	2000-01-13	\N	6'3	\N	L	196	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9484	9484	jamie-drysdale
5395	elias-salomonsson	Elias Salomonsson	D	311	\N	\N	\N	\N	\N	2004-08-31	\N	6'0	\N	R	172	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10448	10448	jamie-drysdale
5401	mackenzie-maceachern	Mackenzie Maceachern	L	295	\N	\N	\N	\N	\N	1994-03-09	\N	6'2	\N	L	193	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6462	6462	jamie-drysdale
5404	max-mccue	Max Mccue	C	301	\N	\N	\N	\N	\N	2003-02-10	\N	6'1	\N	L	182	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10471	10471	jamie-drysdale
5406	sam-lipkin	Sam Lipkin	F	323	\N	\N	\N	\N	\N	2003-01-03	\N	6'2	\N	L	192	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10111	10111	jamie-drysdale
5371	chas-sharpe	Chas Sharpe	D	322	\N	\N	\N	\N	\N	2003-11-28	\N	6.03	\N	R	204	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10144	10144	jamie-drysdale
5362	mitchell-vande-sompel	Mitchell Vande Sompel	D	299	\N	\N	\N	\N	\N	1997-02-11	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6840	6840	jamie-drysdale
5352	dino-kambeitz	Dino Kambeitz	R	295	\N	\N	\N	\N	\N	2000-01-25	\N	6.02	\N	R	212	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8813	8813	jamie-drysdale
5374	ian-mckinnon	Ian Mckinnon	F	302	\N	\N	\N	\N	\N	1998-03-05	\N	6.02	\N	L	212	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8625	8625	jamie-drysdale
5390	bryan-yoon	Bryan Yoon	D	303	\N	\N	\N	\N	\N	1998-01-27	\N	6.01	\N	R	178	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10012	10012	jamie-drysdale
5383	ryan-sandelin	Ryan Sandelin	F	308	\N	\N	\N	\N	\N	1999-01-03	\N	6.00	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9655	9655	jamie-drysdale
5305	jon-mcdonald	Jon Mcdonald	D	307	\N	\N	\N	\N	\N	1998-06-15	\N	6.00	\N	L	181	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9820	9820	jamie-drysdale
5489	will-dineen	Will Dineen	F	309	\N	\N	\N	\N	\N	2000-11-17	\N	6.02	\N	L	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10505	10505	jamie-drysdale
5505	david-gagnon	David Gagnon	F	300	\N	\N	\N	\N	\N	2000-04-19	\N	6.00	\N	L	181	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10778	10778	jamie-drysdale
5512	jaxon-nelson	Jaxon Nelson	F	308	\N	\N	\N	\N	\N	2000-03-30	\N	6.04	\N	R	219	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10094	10094	jamie-drysdale
5521	sam-stange	Sam Stange	F	319	\N	\N	\N	\N	\N	2001-04-20	\N	6.01	\N	R	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10841	10841	jamie-drysdale
5527	alex-gallant	Alex Gallant	L	298	\N	\N	\N	\N	\N	0000-00-00	\N	5.11	\N	L	216	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6142	6142	jamie-drysdale
5437	brandon-hickey	Brandon Hickey	D	306	\N	\N	\N	\N	\N	1996-04-13	\N	6.02	\N	L	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7444	7444	jamie-drysdale
5412	carson-bantle	Carson Bantle	L	304	\N	\N	\N	\N	\N	2002-01-22	\N	6'1	\N	L	210	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10476	10476	jamie-drysdale
5414	colton-white	Colton White	D	324	\N	\N	\N	\N	\N	1997-05-03	\N	6'1	\N	L	187	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6362	6362	jamie-drysdale
5416	dalton-bancroft	Dalton Bancroft	R	312	\N	\N	\N	\N	\N	2001-02-26	\N	6'3	\N	R	212	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10584	10584	jamie-drysdale
5418	dmitry-osipov	Dmitry Osipov	D	324	\N	\N	\N	\N	\N	1996-10-04	\N	6'4	\N	R	230	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6879	6879	jamie-drysdale
5424	justin-ertel	Justin Ertel	L	321	\N	\N	\N	\N	\N	2003-05-27	\N	6'2	\N	L	191	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10451	10451	jamie-drysdale
5426	leon-muggli	Leon Muggli	D	307	\N	\N	\N	\N	\N	2006-07-09	\N	6'0	\N	L	165	\N	CHE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10592	10592	jamie-drysdale
5434	stanislav-svozil	Stanislav Svozil	D	301	\N	\N	\N	\N	\N	2003-01-17	\N	6'0	\N	L	192	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9735	9735	jamie-drysdale
5440	dylan-hryckowian	Dylan Hryckowian	F	321	\N	\N	\N	\N	\N	2004-05-19	\N	5'10	\N	R	180	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10999	10999	jamie-drysdale
5443	gavin-brindley	Gavin Brindley	R	303	\N	\N	\N	\N	\N	2004-10-05	\N	5'8	\N	R	173	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10481	10481	jamie-drysdale
5446	jack-matier	Jack Matier	D	312	\N	\N	\N	\N	\N	2003-04-08	\N	6'6	\N	R	205	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9757	9757	jamie-drysdale
5448	josh-filmon	Josh Filmon	F	324	\N	\N	\N	\N	\N	2004-03-18	\N	6'1	\N	L	158	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9681	9681	jamie-drysdale
5452	leo-loof	Leo Loof	D	319	\N	\N	\N	\N	\N	2002-04-25	\N	6'2	\N	L	201	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9862	9862	jamie-drysdale
5460	steven-santini	Steven Santini	D	320	\N	\N	\N	\N	\N	1995-03-07	\N	6'3	\N	R	217	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6522	6522	jamie-drysdale
5463	ty-murchison	Ty Murchison	D	310	\N	\N	\N	\N	\N	2003-02-02	\N	6'2	\N	L	212	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10552	10552	jamie-drysdale
5464	andrew-basha	Andrew Basha	L	298	\N	\N	\N	\N	\N	2005-11-08	\N	5'11	\N	L	174	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10753	10753	jamie-drysdale
5354	jackson-dorrington	Jackson Dorrington	D	305	\N	\N	\N	\N	\N	2004-04-13	\N	6'3	\N	L	216	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10523	10523	jamie-drysdale
5359	joseph-labate	Joseph Labate	C	295	\N	\N	\N	\N	\N	1993-04-16	\N	6'5	\N	L	225	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5882	5882	jamie-drysdale
5479	marshall-rifai	Marshall Rifai	D	322	\N	\N	\N	\N	\N	1998-03-16	\N	6'2	\N	L	211	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9072	9072	jamie-drysdale
5480	massimo-rizzo	Massimo Rizzo	F	312	\N	\N	\N	\N	\N	2001-06-13	\N	5'10	\N	L	175	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10166	10166	jamie-drysdale
5483	rasmus-kumpulainen	Rasmus Kumpulainen	F	308	\N	\N	\N	\N	\N	2005-08-08	\N	6'2	\N	L	191	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10917	10917	jamie-drysdale
5487	tyrel-bauer	Tyrel Bauer	D	311	\N	\N	\N	\N	\N	2002-03-23	\N	6'3	\N	R	207	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9555	9555	jamie-drysdale
5494	anri-ravinskis	Anri Ravinskis	L	295	\N	\N	\N	\N	\N	2003-01-02	\N	6'2	\N	L	186	\N	LVA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10919	10919	jamie-drysdale
5498	bryce-montgomery	Bryce Montgomery	D	300	\N	\N	\N	\N	\N	2002-11-12	\N	6'4	\N	R	220	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10182	10182	jamie-drysdale
5501	christoffer-sedoff	Christoffer Sedoff	D	312	\N	\N	\N	\N	\N	2002-02-20	\N	6'2	\N	L	209	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9951	9951	jamie-drysdale
5503	connor-clattenburg	Connor Clattenburg	L	296	\N	\N	\N	\N	\N	2005-05-02	\N	6'2	\N	L	215	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10595	10595	jamie-drysdale
5508	eriks-mateiko	Eriks Mateiko	C	307	\N	\N	\N	\N	\N	2005-11-18	\N	6'5	\N	L	208	\N	LVA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10866	10866	jamie-drysdale
5513	kalle-vaisanen	Kalle Vaisanen	F	305	\N	\N	\N	\N	\N	2003-01-28	\N	6'5	\N	R	200	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10123	10123	jamie-drysdale
5450	kenta-isogai	Kenta Isogai	F	313	\N	\N	\N	\N	\N	2004-08-28	\N	5.11	\N	R	175	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10703	10703	jamie-drysdale
5456	red-savage	Red Savage	C	315	\N	\N	\N	\N	\N	2003-05-15	\N	5.11	\N	L	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10926	10926	jamie-drysdale
5485	sloan-stanick	Sloan Stanick	F	306	\N	\N	\N	\N	\N	2003-08-01	\N	5.10	\N	L	171	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10286	10286	jamie-drysdale
5458	shawn-element	Shawn Element	L	312	\N	\N	\N	\N	\N	2000-04-23	\N	5.11	\N	L	201	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8837	8837	jamie-drysdale
5361	lleyton-moore	Lleyton Moore	D	323	\N	\N	\N	\N	\N	2002-02-27	\N	5.08	\N	L	179	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9216	9216	jamie-drysdale
5432	sam-bitten	Sam Bitten	L	307	\N	\N	\N	\N	\N	2000-03-21	\N	6.02	\N	L	220	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9881	9881	jamie-drysdale
5596	jake-boltmann	Jake Boltmann	D	318	\N	\N	\N	\N	\N	2001-10-19	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10981	10981	jamie-drysdale
5632	zack-hayes	Zack Hayes	D	312	\N	\N	\N	\N	\N	1999-04-24	\N	6.03	\N	L	226	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7698	7698	jamie-drysdale
5625	tyler-inamoto	Tyler Inamoto	D	296	\N	\N	\N	\N	\N	1999-05-06	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9117	9117	jamie-drysdale
5636	austin-brimmer	Austin Brimmer	R	295	\N	\N	\N	\N	\N	2001-08-10	\N	6.03	\N	R	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10973	10973	jamie-drysdale
5634	aiden-hansen-bukata	Aiden Hansen-bukata	D	303	\N	\N	\N	\N	\N	1999-06-29	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10580	10580	jamie-drysdale
5647	christopher-douglas	Christopher Douglas	R	315	\N	\N	\N	\N	\N	2000-07-06	\N	6.02	\N	R	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10977	10977	jamie-drysdale
5630	yanick-turcotte	Yanick Turcotte	L	300	\N	\N	\N	\N	\N	0000-00-00	\N	6.00	\N	L	203	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6937	6937	jamie-drysdale
5651	dawson-barteaux	Dawson Barteaux	D	311	\N	\N	\N	\N	\N	2000-01-12	\N	6.02	\N	R	191	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8454	8454	jamie-drysdale
5642	case-mccarthy	Case Mccarthy	D	305	\N	\N	\N	\N	\N	2001-01-08	\N	6.01	\N	R	198	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10154	10154	jamie-drysdale
5576	ryan-kirwan	Ryan Kirwan	L	322	\N	\N	\N	\N	\N	2002-02-27	\N	6.02	\N	L	195	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10551	10551	jamie-drysdale
5530	axel-sandin-pellikka	Axel Sandin-pellikka	D	304	\N	\N	\N	\N	\N	2005-03-11	\N	6'0	\N	R	186	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10628	10628	jamie-drysdale
5533	cade-webber	Cade Webber	D	322	\N	\N	\N	\N	\N	2001-01-05	\N	6'7	\N	L	212	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10426	10426	jamie-drysdale
5540	dylan-wendt	Dylan Wendt	F	324	\N	\N	\N	\N	\N	2001-01-09	\N	6'1	\N	R	195	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10107	10107	jamie-drysdale
5542	eddie-genborg	Eddie Genborg	F	304	\N	\N	\N	\N	\N	2007-04-20	\N	6'1	\N	L	179	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10982	10982	jamie-drysdale
5547	jack-anderson	Jack Anderson	D	321	\N	\N	\N	\N	\N	2002-11-14	\N	6'6	\N	R	225	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10989	10989	jamie-drysdale
5554	josh-bloom	Josh Bloom	L	296	\N	\N	\N	\N	\N	2003-06-08	\N	6'2	\N	L	182	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9135	9135	jamie-drysdale
5556	kaleb-lawrence	Kaleb Lawrence	C	315	\N	\N	\N	\N	\N	2003-01-10	\N	6'7	\N	L	230	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9245	9245	jamie-drysdale
5560	mason-geertsen	Mason Geertsen	L	315	\N	\N	\N	\N	\N	1995-04-19	\N	6'4	\N	L	231	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5475	5475	jamie-drysdale
5565	milo-roelens	Milo Roelens	C	320	\N	\N	\N	\N	\N	2003-01-16	\N	6'7	\N	L	225	\N	BEL	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10165	10165	jamie-drysdale
5572	riley-kidney	Riley Kidney	C	297	\N	\N	\N	\N	\N	2003-03-25	\N	5'11	\N	L	190	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9180	9180	jamie-drysdale
5574	roger-mcqueen	Roger Mcqueen	C	317	\N	\N	\N	\N	\N	2006-10-02	\N	6'5	\N	R	197	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11036	11036	jamie-drysdale
5580	artem-grushnikov	Artem Grushnikov	D	298	\N	\N	\N	\N	\N	2003-03-20	\N	6'1	\N	L	203	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9727	9727	jamie-drysdale
5475	kyle-burroughs	Kyle Burroughs	D	313	\N	\N	\N	\N	\N	1995-07-12	\N	6'0	\N	R	193	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5478	5478	jamie-drysdale
5592	felix-trudeau	Felix Trudeau	F	319	\N	\N	\N	\N	\N	2002-09-24	\N	6'2	\N	L	190	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11008	11008	jamie-drysdale
5594	hank-kempf	Hank Kempf	D	303	\N	\N	\N	\N	\N	2002-04-15	\N	6'2	\N	L	190	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10588	10588	jamie-drysdale
5601	justin-janicke	Justin Janicke	F	302	\N	\N	\N	\N	\N	2003-06-30	\N	5'11	\N	L	189	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10548	10548	jamie-drysdale
5606	luke-kunin	Luke Kunin	C	299	\N	\N	\N	\N	\N	1997-12-04	\N	6'0	\N	R	197	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6659	6659	jamie-drysdale
5611	navrin-mutter	Navrin Mutter	L	314	\N	\N	\N	\N	\N	2001-03-15	\N	6'3	\N	L	202	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7722	7722	jamie-drysdale
5613	noah-beck	Noah Beck	D	318	\N	\N	\N	\N	\N	2001-03-25	\N	6'4	\N	L	184	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10543	10543	jamie-drysdale
5617	riley-patterson	Riley Patterson	C	295	\N	\N	\N	\N	\N	2006-03-22	\N	6'0	\N	R	192	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11053	11053	jamie-drysdale
5619	ryland-mosley	Ryland Mosley	L	316	\N	\N	\N	\N	\N	2000-02-15	\N	5'11	\N	R	195	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10500	10500	jamie-drysdale
5627	vinzenz-rohrer	Vinzenz Rohrer	F	309	\N	\N	\N	\N	\N	2004-09-09	\N	5'11	\N	R	173	\N	AUT	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11088	11088	jamie-drysdale
5640	cameron-butler	Cameron Butler	R	308	\N	\N	\N	\N	\N	2002-06-09	\N	6'4	\N	R	215	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9715	9715	jamie-drysdale
5643	charlie-elick	Charlie Elick	D	301	\N	\N	\N	\N	\N	2006-01-17	\N	6'3	\N	R	194	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10606	10606	jamie-drysdale
5649	david-kampf	David Kampf	F	322	\N	\N	\N	\N	\N	1995-01-12	\N	6'2	\N	L	198	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6860	6860	jamie-drysdale
5590	ethan-frisch	Ethan Frisch	D	311	\N	\N	\N	\N	\N	2000-10-29	\N	5.11	\N	R	192	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9651	9651	jamie-drysdale
5559	lucas-wahlin	Lucas Wahlin	F	311	\N	\N	\N	\N	\N	2001-05-03	\N	5.11	\N	R	160	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11040	11040	jamie-drysdale
5472	josh-jacobs	Josh Jacobs	D	309	\N	\N	\N	\N	\N	1996-02-15	\N	6.02	\N	R	227	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6337	6337	jamie-drysdale
5608	max-grondin	Max Grondin	C	320	\N	\N	\N	\N	\N	2000-07-04	\N	6.04	\N	L	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10986	10986	jamie-drysdale
4826	martin-chromiak	Martin Chromiak	F	313	\N	\N	\N	\N	\N	2002-08-20	\N	6'0	\N	R	187	\N	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8714	8714	jamie-drysdale
5737	erik-bargholtz	Erik Bargholtz	F	318	\N	\N	\N	\N	\N	2001-04-12	\N	6.01	\N	R	203	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11002	11002	jamie-drysdale
5723	christian-felton	Christian Felton	D	295	\N	\N	\N	\N	\N	2000-02-04	\N	6.01	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10029	10029	jamie-drysdale
5725	cole-krygier	Cole Krygier	D	299	\N	\N	\N	\N	\N	2000-05-05	\N	6.02	\N	L	192	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9644	9644	jamie-drysdale
5730	davis-burnside	Davis Burnside	F	311	\N	\N	\N	\N	\N	2003-09-22	\N	6.00	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11041	11041	jamie-drysdale
5756	john-gormley	John Gormley	D	318	\N	\N	\N	\N	\N	2000-08-19	\N	6.04	\N	R	215	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10501	10501	jamie-drysdale
5742	gavin-hain	Gavin Hain	C	305	\N	\N	\N	\N	\N	2003-04-03	\N	5.11	\N	L	196	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9857	9857	jamie-drysdale
5779	ryan-bottrill	Ryan Bottrill	F	308	\N	\N	\N	\N	\N	2004-02-04	\N	6.01	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11006	11006	jamie-drysdale
5758	kale-kessy	Kale Kessy	L	319	\N	\N	\N	\N	\N	1992-12-04	\N	6.04	\N	L	225	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5039	5039	jamie-drysdale
5760	kevin-wall	Kevin Wall	R	319	\N	\N	\N	\N	\N	2000-02-01	\N	6.00	\N	R	207	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9878	9878	jamie-drysdale
5772	maxim-barbashev	Maxim Barbashev	F	323	\N	\N	\N	\N	\N	2003-12-18	\N	6.01	\N	L	187	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9752	9752	jamie-drysdale
5777	romain-rodzinski	Romain Rodzinski	D	307	\N	\N	\N	\N	\N	2002-05-14	\N	6.01	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10935	10935	jamie-drysdale
5719	caige-sterzer	Caige Sterzer	F	305	\N	\N	\N	\N	\N	2000-08-08	\N	6.05	\N	L	216	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11014	11014	jamie-drysdale
5749	jack-bar	Jack Bar	D	318	\N	\N	\N	\N	\N	2010-07-02	\N	6.02	\N	R	210	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10698	10698	jamie-drysdale
5672	lukas-gustafsson	Lukas Gustafsson	D	311	\N	\N	\N	\N	\N	2002-12-16	\N	5.10	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11042	11042	jamie-drysdale
5684	peter-tischke	Peter Tischke	D	315	\N	\N	\N	\N	\N	1996-01-03	\N	6.01	\N	L	224	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7534	7534	jamie-drysdale
5661	jakub-demek	Jakub Demek	F	306	\N	\N	\N	\N	\N	2003-06-06	\N	6'4	\N	L	215	\N	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9269	9269	jamie-drysdale
5663	jordan-gustafson	Jordan Gustafson	F	306	\N	\N	\N	\N	\N	2004-01-20	\N	5'11	\N	L	194	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9271	9271	jamie-drysdale
5665	josh-dunne	Josh Dunne	C	315	\N	\N	\N	\N	\N	1998-12-08	\N	6'4	\N	L	208	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8641	8641	jamie-drysdale
5669	konnor-smith	Konnor Smith	D	317	\N	\N	\N	\N	\N	2004-11-06	\N	6'6	\N	L	234	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10116	10116	jamie-drysdale
5677	max-psenicka	Max Psenicka	D	323	\N	\N	\N	\N	\N	2007-01-18	\N	6'5	\N	R	177	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10669	10669	jamie-drysdale
5680	milan-lucic	Milan Lucic	L	319	\N	\N	\N	\N	\N	1988-06-07	\N	6'3	\N	L	236	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=3068	3068	jamie-drysdale
5681	miroslav-holinka	Miroslav Holinka	C	322	\N	\N	\N	\N	\N	2005-11-10	\N	6'2	\N	R	188	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11070	11070	jamie-drysdale
5692	samuel-laberge	Samuel Laberge	F	318	\N	\N	\N	\N	\N	1997-04-10	\N	6'2	\N	L	206	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6859	6859	jamie-drysdale
5589	dylan-james	Dylan James	L	304	\N	\N	\N	\N	\N	2003-10-12	\N	6'0	\N	L	181	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11071	11071	jamie-drysdale
5709	anton-lundmark	Anton Lundmark	F	299	\N	\N	\N	\N	\N	2001-04-19	\N	6'4	\N	R	192	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10914	10914	jamie-drysdale
5710	artem-guryev	Artem Guryev	D	310	\N	\N	\N	\N	\N	2003-05-17	\N	6'4	\N	L	225	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9260	9260	jamie-drysdale
5713	ben-strinden	Ben Strinden	R	312	\N	\N	\N	\N	\N	2002-06-04	\N	6'2	\N	R	204	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11078	11078	jamie-drysdale
5715	braden-doyle	Braden Doyle	D	300	\N	\N	\N	\N	\N	2001-08-24	\N	5'11	\N	L	162	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10775	10775	jamie-drysdale
5727	curtis-douglas	Curtis Douglas	C	320	\N	\N	\N	\N	\N	2000-03-06	\N	6'9	\N	L	242	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8680	8680	jamie-drysdale
5732	dennis-cesana	Dennis Cesana	D	299	\N	\N	\N	\N	\N	1998-04-04	\N	5'9	\N	R	183	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9021	9021	jamie-drysdale
5734	dyllan-gill	Dyllan Gill	D	320	\N	\N	\N	\N	\N	2004-06-07	\N	6'3	\N	R	194	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10393	10393	jamie-drysdale
5753	james-stefan	James Stefan	R	296	\N	\N	\N	\N	\N	2003-08-09	\N	6'0	\N	R	183	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10394	10394	jamie-drysdale
5761	kienan-draper	Kienan Draper	R	304	\N	\N	\N	\N	\N	2002-02-19	\N	6'0	\N	R	187	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11076	11076	jamie-drysdale
5764	loke-johansson	Loke Johansson	D	314	\N	\N	\N	\N	\N	2005-12-14	\N	6'3	\N	L	213	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10869	10869	jamie-drysdale
5769	matthew-andonovski	Matthew Andonovski	D	297	\N	\N	\N	\N	\N	2005-03-14	\N	6'2	\N	L	215	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10885	10885	jamie-drysdale
5694	simon-pinard	Simon Pinard	F	307	\N	\N	\N	\N	\N	2001-05-26	\N	5.10	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9957	9957	jamie-drysdale
5721	chase-pauls	Chase Pauls	D	298	\N	\N	\N	\N	\N	2003-10-07	\N	6.05	\N	R	220	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10375	10375	jamie-drysdale
5659	jackson-berezowski	Jackson Berezowski	C	302	\N	\N	\N	\N	\N	2002-02-12	\N	5.10	\N	R	191	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9903	9903	jamie-drysdale
4936	angus-crookshank	Angus Crookshank	L	324	\N	\N	\N	\N	\N	1999-10-02	\N	5'10	\N	L	183	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8648	8648	jamie-drysdale
5236	luke-toporowski	Luke Toporowski	R	303	\N	\N	\N	\N	\N	2001-04-12	\N	5.11	\N	L	180	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7782	7782	jamie-drysdale
5331	landen-hookey	Landen Hookey	C	297	\N	\N	\N	\N	\N	2004-01-29	\N	6.05	\N	R	223	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10883	10883	jamie-drysdale
5789	tarun-fizer	Tarun Fizer	R	319	\N	\N	\N	\N	\N	2001-03-01	\N	5.11	\N	R	173	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8898	8898	jamie-drysdale
5703	aiden-dubinsky	Aiden Dubinsky	D	309	\N	\N	\N	\N	\N	2004-04-28	\N	6.00	\N	R	196	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11089	11089	jamie-drysdale
5791	thomas-messineo	Thomas Messineo	D	318	\N	\N	\N	\N	\N	2002-05-02	\N	6.00	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11080	11080	jamie-drysdale
5474	kevin-connauton	Kevin Connauton	D	323	\N	\N	\N	\N	\N	1990-02-23	\N	6'2	\N	L	205	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=3697	3697	jamie-drysdale
5265	carey-terrance	Carey Terrance	F	305	\N	\N	\N	\N	\N	2005-05-10	\N	6'0	\N	L	203	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10276	10276	jamie-drysdale
5563	matthew-stienburg	Matthew Stienburg	F	303	\N	\N	\N	\N	\N	2000-10-07	\N	6'1	\N	R	182	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9683	9683	jamie-drysdale
5378	jake-furlong	Jake Furlong	D	318	\N	\N	\N	\N	\N	2004-03-04	\N	6'1	\N	L	189	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9259	9259	jamie-drysdale
5624	tommy-lafreniere	Tommy Lafreniere	R	296	\N	\N	\N	\N	\N	2007-01-16	\N	5'11	\N	R	172	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11065	11065	jamie-drysdale
5691	saige-weinstein	Saige Weinstein	D	303	\N	\N	\N	\N	\N	2005-05-30	\N	6'1	\N	L	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10129	10129	jamie-drysdale
4955	kasper-halttunen	Kasper Halttunen	F	318	\N	\N	\N	\N	\N	2005-06-07	\N	6'3	\N	R	215	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10231	10231	jamie-drysdale
5002	victor-soderstrom	Victor Soderstrom	D	314	\N	\N	\N	\N	\N	2001-02-26	\N	6'0	\N	R	189	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7704	7704	jamie-drysdale
5075	bryce-mcconnell-barker	Bryce Mcconnell-barker	F	305	\N	\N	\N	\N	\N	2004-06-04	\N	6'1	\N	L	191	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9667	9667	jamie-drysdale
5112	brett-chorske	Brett Chorske	F	299	\N	\N	\N	\N	\N	2001-05-24	\N	6'7	\N	R	216	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10512	10512	jamie-drysdale
5163	jonathan-lekkerimaki	Jonathan Lekkerimaki	R	295	\N	\N	\N	\N	\N	2004-07-24	\N	5'11	\N	R	172	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10057	10057	jamie-drysdale
5234	luca-marrelli	Luca Marrelli	D	301	\N	\N	\N	\N	\N	2005-10-04	\N	6'1	\N	R	181	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10950	10950	jamie-drysdale
5786	stevie-leskovar	Stevie Leskovar	D	308	\N	\N	\N	\N	\N	2004-09-09	\N	6'3	\N	L	207	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10611	10611	jamie-drysdale
5391	charles-alexis-legault	Charles Alexis Legault	D	300	\N	\N	\N	\N	\N	2003-09-05	\N	6'4	\N	R	220	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10460	10460	jamie-drysdale
5439	cooper-flinton	Cooper Flinton	L	320	\N	\N	\N	\N	\N	2003-08-16	\N	6'2	\N	L	213	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10526	10526	jamie-drysdale
9951	matthew-highmore	Matthew Highmore	C	326	\N	\N	\N	\N	\N	1996-02-27	\N	5'11	\N	L	192	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6861	6861	jamie-drysdale
10024	matthew-maggio	Matthew Maggio	F	326	\N	\N	\N	\N	\N	2002-11-25	\N	5'11	\N	R	194	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9443	9443	jamie-drysdale
10078	alex-jefferies	Alex Jefferies	F	326	\N	\N	\N	\N	\N	2001-11-08	\N	6'1	\N	R	192	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10040	10040	jamie-drysdale
10091	ethan-bear	Ethan Bear	D	326	\N	\N	\N	\N	\N	1997-06-26	\N	5'11	\N	R	219	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6807	6807	jamie-drysdale
10115	joona-koppanen	Joona Koppanen	C	325	\N	\N	\N	\N	\N	1998-02-25	\N	6'5	\N	L	216	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7017	7017	jamie-drysdale
10174	hunter-drew	Hunter Drew	R	326	\N	\N	\N	\N	\N	1998-10-21	\N	6'2	\N	R	191	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7627	7627	jamie-drysdale
10259	isaiah-george	Isaiah George	D	326	\N	\N	\N	\N	\N	2004-02-15	\N	6'1	\N	L	203	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10389	10389	jamie-drysdale
10289	sean-day	Sean Day	D	326	\N	\N	\N	\N	\N	1998-01-09	\N	6'3	\N	L	225	\N	BEL	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7248	7248	jamie-drysdale
10306	tanner-howe	Tanner Howe	L	325	\N	\N	\N	\N	\N	2005-11-28	\N	5'11	\N	L	183	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10962	10962	jamie-drysdale
10420	bokondji-imama	Bokondji Imama	L	325	\N	\N	\N	\N	\N	1996-08-03	\N	6'1	\N	L	223	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6865	6865	jamie-drysdale
10444	victor-eklund	Victor Eklund	F	326	\N	\N	\N	\N	\N	2006-10-03	\N	5'11	\N	R	161	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11013	11013	jamie-drysdale
10450	cole-eiserman	Cole Eiserman	F	326	\N	\N	\N	\N	\N	2006-08-29	\N	6'0	\N	L	195	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10994	10994	jamie-drysdale
10501	harrison-brunicke	Harrison Brunicke	D	325	\N	\N	\N	\N	\N	2006-05-08	\N	6'3	\N	R	201	\N	ZAF	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10542	10542	jamie-drysdale
5793	troy-murray	Troy Murray	F	319	\N	\N	\N	\N	\N	1997-09-05	\N	6.02	\N	L	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10941	10941	jamie-drysdale
5795	valtteri-piironen	Valtteri Piironen	D	302	\N	\N	\N	\N	\N	2001-09-11	\N	6.04	\N	L	201	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11029	11029	jamie-drysdale
5798	will-riedell	Will Riedell	D	314	\N	\N	\N	\N	\N	1996-10-09	\N	6.02	\N	L	198	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9064	9064	jamie-drysdale
5029	jamie-engelbert	Jamie Engelbert	F	316	\N	\N	\N	\N	\N	2000-06-21	\N	6.00	\N	L	165	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10503	10503	jamie-drysdale
5763	landon-mccallum	Landon Mccallum	F	302	\N	\N	\N	\N	\N	2003-09-05	\N	5.11	\N	R	175	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10384	10384	jamie-drysdale
4972	igor-chernyshov	Igor Chernyshov	F	318	\N	\N	\N	\N	\N	2005-11-30	\N	6'2	\N	R	195	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10494	10494	jamie-drysdale
10513	ryan-mcallister	Ryan Mcallister	F	325	\N	\N	\N	\N	\N	2001-12-19	\N	5'10	\N	L	183	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9695	9695	jamie-drysdale
10576	zach-gallant	Zach Gallant	R	325	\N	\N	\N	\N	\N	1999-03-06	\N	6'2	\N	L	188	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7733	7733	jamie-drysdale
10596	gleb-veremyev	Gleb Veremyev	F	326	\N	\N	\N	\N	\N	2003-06-28	\N	6'5	\N	L	218	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10521	10521	jamie-drysdale
10624	calum-ritchie	Calum Ritchie	C	326	\N	\N	\N	\N	\N	2005-01-21	\N	6'2	\N	R	200	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10258	10258	jamie-drysdale
10636	emil-pieniniemi	Emil Pieniniemi	D	325	\N	\N	\N	\N	\N	2005-03-02	\N	6'3	\N	L	191	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10172	10172	jamie-drysdale
10675	brandon-buhr	Brandon Buhr	F	322	\N	\N	\N	\N	\N	2002-07-07	\N	6'2	\N	R	205	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10992	10992	jamie-drysdale
10696	jesse-pulkkinen	Jesse Pulkkinen	D	326	\N	\N	\N	\N	\N	2004-12-27	\N	6'7	\N	L	220	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10520	10520	jamie-drysdale
10737	andrej-sustr	Andrej Sustr	D	326	\N	\N	\N	\N	\N	1990-11-29	\N	6'7	\N	R	217	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4874	4874	jamie-drysdale
10758	filip-hallander	Filip Hallander	L	325	\N	\N	\N	\N	\N	2000-06-29	\N	6'1	\N	L	203	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8892	8892	jamie-drysdale
11922	braidan-simmons-fischer	Braidan Simmons-fischer	D	308	\N	\N	\N	\N	\N	2002-01-26	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10886	10886	jamie-drysdale
10835	chris-hedden	Chris Hedden	D	303	\N	\N	\N	\N	\N	2002-09-20	\N	6.00	\N	L	197	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10985	10985	jamie-drysdale
624	hunter-brzustewicz	Hunter Brzustewicz	D	298	8484150	48	\N	\N	\N	2004-11-29	Washington, Michigan, USA	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8484150.png	R	190	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10170	10170	jamie-drysdale
10789	nick-leddy	Nick Leddy	D	318	\N	\N	\N	\N	\N	1991-03-20	\N	6'0	\N	L	205	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=3859	3859	jamie-drysdale
10841	daniil-prokhorov	Daniil Prokhorov	F	326	\N	\N	\N	\N	\N	2007-04-27	\N	6'5	\N	L	209	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11092	11092	jamie-drysdale
10885	mack-oliphant	Mack Oliphant	D	318	\N	\N	\N	\N	\N	2002-12-28	\N	6.03	\N	R	195	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10988	10988	jamie-drysdale
10909	scott-reedy	Scott Reedy	F	326	\N	\N	\N	\N	\N	1999-04-04	\N	6.02	\N	R	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8693	8693	jamie-drysdale
9989	gabe-klassen	Gabe Klassen	C	325	\N	\N	\N	\N	\N	2003-06-30	\N	5.10	\N	L	178	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9223	9223	jamie-drysdale
418	dmitri-simashev	Dmitri Simashev	D	323	8484386	26	\N	\N	\N	2005-02-04	Kostroma, RUS	6'4	https://assets.nhle.com/mugs/nhl/latest/168x168/8484386.png	L	198	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10665	10665	jamie-drysdale
4808	dryden-hunt	Dryden Hunt	L	298	\N	\N	\N	\N	\N	1995-11-24	\N	6'0	\N	L	193	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6367	6367	jamie-drysdale
4894	oliver-wahlstrom	Oliver Wahlstrom	R	318	\N	\N	\N	\N	\N	2000-06-13	\N	6'2	\N	R	205	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7575	7575	jamie-drysdale
10829	broten-sabo	Broten Sabo	D	325	\N	\N	\N	\N	\N	2002-08-09	\N	6.02	\N	L	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11020	11020	jamie-drysdale
10891	max-graham	Max Graham	F	325	\N	\N	\N	\N	\N	2004-05-21	\N	6'3	\N	L	215	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10853	10853	jamie-drysdale
10896	quinn-beauchesne	Quinn Beauchesne	D	325	\N	\N	\N	\N	\N	2007-03-01	\N	6'0	\N	R	184	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11061	11061	jamie-drysdale
9911	liam-foudy	Liam Foudy	F	326	\N	\N	\N	\N	\N	2000-02-04	\N	6'1	\N	L	186	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7655	7655	jamie-drysdale
9926	tristan-broz	Tristan Broz	F	325	\N	\N	\N	\N	\N	2002-10-10	\N	6'0	\N	L	204	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10164	10164	jamie-drysdale
9953	rafael-harvey-pinard	Rafael Harvey-pinard	L	325	\N	\N	\N	\N	\N	1999-01-06	\N	5'9	\N	L	179	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7802	7802	jamie-drysdale
9981	atley-calvert	Atley Calvert	C	325	\N	\N	\N	\N	\N	2003-09-17	\N	6'1	\N	R	194	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10326	10326	jamie-drysdale
10706	max-dorrington	Max Dorrington	F	326	\N	\N	\N	\N	\N	2001-08-30	\N	6.03	\N	R	215	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10510	10510	jamie-drysdale
10917	tommy-budnick	Tommy Budnick	D	325	\N	\N	\N	\N	\N	2004-02-14	\N	6.01	\N	L	210	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10849	10849	jamie-drysdale
66	viking-gustafsson-nyberg	Viking Gustafsson Nyberg	D	308	8486166	6	\N	\N	\N	2003-09-21	Stockholm, SWE	6'6	https://assets.nhle.com/mugs/nhl/latest/168x168/8486166.png	L	225	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11052	11052	jamie-drysdale
95	adam-engstrom	Adam Engstrom	D	309	8483686	42	\N	\N	\N	2003-11-17	Jarna, SWE	6'2	https://assets.nhle.com/mugs/nhl/latest/168x168/8483686.png	L	193	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10437	10437	jamie-drysdale
543	ian-moore	Ian Moore	D	317	8482178	3	\N	\N	\N	2002-01-04	Salt Lake City, Utah, USA	6'3	https://assets.nhle.com/mugs/nhl/latest/168x168/8482178.png	R	205	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10514	10514	jamie-drysdale
4865	lane-pederson	Lane Pederson	C	310	\N	\N	\N	\N	\N	1997-08-04	\N	6'1	https://www.hockeydb.com/ihdb/photos/lane-pederson-2026-53.jpg	R	196	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6872	6872	jamie-drysdale
4926	samuel-blais	Samuel Blais	L	309	\N	\N	\N	\N	\N	1996-06-17	\N	6.02	\N	L	206	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5970	5970	jamie-drysdale
617	martin-pospisil	Martin Pospisil	C	298	8481028	76	\N	\N	\N	1999-11-19	Zvolen, SVK	6'2	https://assets.nhle.com/mugs/nhl/latest/168x168/8481028.png	L	173	\N	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7971	7971	jamie-drysdale
5195	grant-cruikshank	Grant Cruikshank	C	307	\N	\N	\N	\N	\N	1998-07-19	\N	6.01	\N	R	170	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9698	9698	jamie-drysdale
353	dominic-james	Dominic James	C	320	8483752	17	\N	\N	\N	2002-07-03	Plymouth, Michigan, USA	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8483752.png	L	190	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10903	10903	jamie-drysdale
5536	carter-wilkie	Carter Wilkie	C	298	\N	\N	\N	\N	\N	2000-04-03	\N	6.02	\N	R	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10547	10547	jamie-drysdale
5007	nate-smith	Nate Smith	C	299	\N	\N	\N	\N	\N	1998-10-19	\N	6.00	\N	R	177	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9220	9220	jamie-drysdale
385	emil-andrae	Emil Andrae	D	310	8482126	\N	\N	\N	\N	2002-02-23	Vastervik, SWE	5'9	https://assets.nhle.com/mugs/nhl/latest/168x168/8482126.png	L	189	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9628	9628	jamie-drysdale
5289	hunter-st-martin	Hunter St. Martin	F	299	\N	\N	\N	\N	\N	2005-06-13	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10915	10915	jamie-drysdale
5428	nikita-susuyev	Nikita Susuyev	F	319	\N	\N	\N	\N	\N	2005-02-06	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10846	10846	jamie-drysdale
5567	niko-huuhtanen	Niko Huuhtanen	R	320	\N	\N	\N	\N	\N	2003-06-26	\N	6.03	\N	R	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9171	9171	jamie-drysdale
5787	sullivan-mack	Sullivan Mack	F	305	\N	\N	\N	\N	\N	2000-07-05	\N	6.01	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10581	10581	jamie-drysdale
10221	cam-berg	Cam Berg	F	326	\N	\N	\N	\N	\N	2002-01-29	\N	6.00	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10564	10564	jamie-drysdale
5047	tyler-angle	Tyler Angle	R	304	\N	\N	\N	\N	\N	2000-09-30	\N	5.09	\N	L	165	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8581	8581	jamie-drysdale
545	noah-warren	Noah Warren	D	317	8483521	47	\N	\N	\N	2004-07-15	Montréal, Quebec, CAN	6'4	https://assets.nhle.com/mugs/nhl/latest/168x168/8483521.png	R	224	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9197	9197	jamie-drysdale
567	jordan-harris	Jordan Harris	D	314	8480887	43	\N	\N	\N	2000-07-07	Haverhill, Massachusetts, USA	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8480887.png	L	189	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10955	10955	jamie-drysdale
483	ilya-protas	Ilya Protas	C	307	8484999	62	\N	\N	\N	2006-07-18	Vitebsk, BLR	6'6	https://assets.nhle.com/mugs/nhl/latest/168x168/8484999.png	L	225	\N	BLR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10644	10644	jamie-drysdale
668	landon-slaggert	Landon Slaggert	F	316	8482172	84	\N	\N	\N	2002-06-25	South Bend, Indiana, USA	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8482172.png	L	180	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10342	10342	jamie-drysdale
586	noah-ostlund	Noah Ostlund	C	315	8483500	86	\N	\N	\N	2004-03-11	Stockholm, SWE	5'11	https://assets.nhle.com/mugs/nhl/latest/168x168/8483500.png	L	180	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10157	10157	jamie-drysdale
620	aydar-suniev	Aydar Suniev	L	298	8484234	36	\N	\N	\N	2004-11-16	Kazan, RUS	6'2	https://assets.nhle.com/mugs/nhl/latest/168x168/8484234.png	L	198	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10755	10755	jamie-drysdale
222	carter-yakemchuk	Carter Yakemchuk	D	297	8484759	58	\N	\N	\N	2005-09-29	Fort McMurray, Alberta, CAN	6'3	https://assets.nhle.com/mugs/nhl/latest/168x168/8484759.png	R	219	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10922	10922	jamie-drysdale
733	arttu-hyry	Arttu Hyry	C	321	8484938	25	\N	\N	\N	2001-04-06	Oulu, FIN	6'3	https://assets.nhle.com/mugs/nhl/latest/168x168/8484938.png	R	211	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10450	10450	jamie-drysdale
597	radim-mrtka	Radim Mrtka	D	315	8485404	57	\N	\N	\N	2007-06-09	Havlickuv Brod, CZE	6'6	https://assets.nhle.com/mugs/nhl/latest/168x168/8485404.png	R	218	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10911	10911	jamie-drysdale
433	max-sasson	Max Sasson	C	295	8484136	63	\N	\N	\N	2000-09-05	Birmingham, Michigan, USA	6'1	https://assets.nhle.com/mugs/nhl/latest/168x168/8484136.png	L	181	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9659	9659	jamie-drysdale
69	matt-kiersted	Matt Kiersted	D	308	8482641	26	\N	\N	\N	1998-04-14	Elk River, Minnesota, USA	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8482641.png	L	182	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8937	8937	jamie-drysdale
273	ryan-graves	Ryan Graves	D	325	8477435	27	\N	\N	\N	1995-05-21	Yarmouth, Nova Scotia, CAN	6'5	https://assets.nhle.com/mugs/nhl/latest/168x168/8477435.png	L	225	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6082	6082	jamie-drysdale
4841	benoit-olivier-groulx	Benoit-olivier Groulx	C	322	\N	\N	\N	\N	\N	2000-02-06	\N	6.02	https://www.hockeydb.com/ihdb/photos/benoit-groulx-2010-3.jpg	L	204	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7693	7693	jamie-drysdale
5151	maxim-groshev	Maxim Groshev	D	320	\N	\N	\N	\N	\N	2001-12-14	\N	6'2	\N	L	196	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9896	9896	jamie-drysdale
4896	ben-berard	Ben Berard	F	295	\N	\N	\N	\N	\N	1999-02-13	\N	6.00	https://www.hockeydb.com/ihdb/photos/ben-berard-2024-233.jpg	L	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9674	9674	jamie-drysdale
4827	patrick-brown	Patrick Brown	F	314	\N	\N	\N	\N	\N	1992-05-29	\N	6'1	\N	R	217	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5721	5721	jamie-drysdale
4814	martin-frk	Martin Frk	R	298	\N	\N	\N	\N	\N	1993-10-05	\N	6'1	\N	R	210	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5018	5018	jamie-drysdale
4882	aleksanteri-kaskimaki	Aleksanteri Kaskimaki	F	319	\N	\N	\N	\N	\N	2004-02-06	\N	6'0	\N	L	195	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10328	10328	jamie-drysdale
4859	sam-poulin	Sam Poulin	C	296	\N	\N	\N	\N	\N	2001-02-25	\N	6.02	\N	L	213	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8890	8890	jamie-drysdale
4937	brendan-gaunce	Brendan Gaunce	C	301	\N	\N	\N	\N	\N	1994-03-25	\N	6'2	\N	L	222	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5645	5645	jamie-drysdale
4979	skyler-brind-amour	Skyler Brind'amour	F	300	\N	\N	\N	\N	\N	1999-07-27	\N	6'2	\N	L	195	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9742	9742	jamie-drysdale
5017	jakub-rychlovsky	Jakub Rychlovsky	L	304	\N	\N	\N	\N	\N	2001-08-07	\N	5'11	\N	L	196	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10453	10453	jamie-drysdale
5092	austin-watson	Austin Watson	R	304	\N	\N	\N	\N	\N	1992-01-13	\N	6'4	\N	R	203	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4085	4085	jamie-drysdale
5129	wyatt-aamodt	Wyatt Aamodt	D	303	\N	\N	\N	\N	\N	1997-11-22	\N	6'0	\N	L	201	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9118	9118	jamie-drysdale
5179	jack-rathbone	Jack Rathbone	D	315	\N	\N	\N	\N	\N	1999-05-20	\N	5'11	\N	L	188	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8619	8619	jamie-drysdale
5214	jake-livingstone	Jake Livingstone	D	299	\N	\N	\N	\N	\N	1999-04-16	\N	6'4	\N	R	213	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9880	9880	jamie-drysdale
5120	juuso-valimaki	Juuso Valimaki	D	300	\N	\N	\N	\N	\N	1998-10-06	\N	6'2	\N	L	201	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7490	7490	jamie-drysdale
5270	keaton-middleton	Keaton Middleton	D	303	\N	\N	\N	\N	\N	1998-02-10	\N	6'6	\N	L	240	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7218	7218	jamie-drysdale
5301	caleb-macdonald	Caleb Macdonald	D	301	\N	\N	\N	\N	\N	2002-11-29	\N	6'4	\N	L	225	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10895	10895	jamie-drysdale
5325	cole-clayton	Cole Clayton	D	295	\N	\N	\N	\N	\N	2000-02-29	\N	6'2	\N	R	198	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8916	8916	jamie-drysdale
5238	otto-stenberg	Otto Stenberg	F	319	\N	\N	\N	\N	\N	2005-05-29	\N	5'11	\N	L	188	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10495	10495	jamie-drysdale
5673	marcel-marcel	Marcel Marcel	F	316	\N	\N	\N	\N	\N	2003-10-31	\N	6.04	\N	L	243	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9839	9839	jamie-drysdale
5409	anton-johansson	Anton Johansson	D	304	\N	\N	\N	\N	\N	2004-06-10	\N	6'4	\N	R	172	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10509	10509	jamie-drysdale
5461	tomas-hamara	Tomas Hamara	D	297	\N	\N	\N	\N	\N	2004-03-09	\N	6'0	\N	L	194	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10145	10145	jamie-drysdale
5497	brayden-hislop	Brayden Hislop	D	316	\N	\N	\N	\N	\N	2003-09-26	\N	6.01	\N	L	180	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10967	10967	jamie-drysdale
5506	djibril-toure	Djibril Toure	D	297	\N	\N	\N	\N	\N	2003-06-05	\N	6'7	\N	R	217	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9906	9906	jamie-drysdale
5532	brady-stonehouse	Brady Stonehouse	R	296	\N	\N	\N	\N	\N	2004-08-06	\N	5'10	\N	L	193	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9229	9229	jamie-drysdale
5558	landon-sim	Landon Sim	F	322	\N	\N	\N	\N	\N	2004-07-17	\N	5'10	\N	L	166	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10836	10836	jamie-drysdale
5733	dillan-bentley	Dillan Bentley	F	309	\N	\N	\N	\N	\N	2001-03-31	\N	6.04	\N	R	192	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10983	10983	jamie-drysdale
5618	robby-fabbri	Robby Fabbri	C	299	\N	\N	\N	\N	\N	1996-01-22	\N	5'11	\N	L	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5954	5954	jamie-drysdale
5644	chase-wheatcroft	Chase Wheatcroft	F	321	\N	\N	\N	\N	\N	2002-05-28	\N	6'3	\N	L	190	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9750	9750	jamie-drysdale
10529	jack-st-ivany	Jack St. Ivany	D	325	\N	\N	\N	\N	\N	1999-07-22	\N	6.04	\N	R	197	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9359	9359	jamie-drysdale
5690	ryan-hofer	Ryan Hofer	R	307	\N	\N	\N	\N	\N	2002-05-10	\N	6'3	\N	L	184	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9818	9818	jamie-drysdale
92	florian-xhekaj	Florian Xhekaj	C	309	8484403	63	\N	\N	\N	2004-06-27	Hamilton, Ontario, CAN	6'3	https://assets.nhle.com/mugs/nhl/latest/168x168/8484403.png	L	195	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10139	10139	jamie-drysdale
5745	herman-traff	Herman Traff	R	317	\N	\N	\N	\N	\N	2005-12-31	\N	6'3	\N	R	216	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11017	11017	jamie-drysdale
5790	terrell-goldsmith	Terrell Goldsmith	D	323	\N	\N	\N	\N	\N	2005-05-13	\N	6'4	\N	L	223	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9773	9773	jamie-drysdale
578	riley-fiddler-schultz	Riley Fiddler-schultz	L	315	8483090	45	\N	\N	\N	2002-05-13	Edmonton, Alberta, CAN	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8483090.png	L	197	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9923	9923	jamie-drysdale
10085	owen-pickering	Owen Pickering	D	325	\N	\N	\N	\N	\N	2004-01-27	\N	6'5	\N	L	206	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9673	9673	jamie-drysdale
5394	dillon-boucher	Dillon Boucher	F	316	\N	\N	\N	\N	\N	1997-04-16	\N	6.00	\N	L	195	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10403	10403	jamie-drysdale
10685	egor-zamula	Egor Zamula	D	325	\N	\N	\N	\N	\N	2000-03-30	\N	6'3	\N	L	200	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7850	7850	jamie-drysdale
10858	gavin-mccarthy	Gavin Mccarthy	D	315	\N	\N	\N	\N	\N	2005-06-02	\N	6'2	\N	R	194	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10987	10987	jamie-drysdale
5172	angus-booth	Angus Booth	D	313	\N	\N	\N	\N	\N	2004-04-27	\N	6'0	\N	L	177	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9249	9249	jamie-drysdale
5263	andrei-loshko	Andrei Loshko	F	302	\N	\N	\N	\N	\N	2004-10-07	\N	6'1	\N	L	172	\N	BLR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10181	10181	jamie-drysdale
4927	brendan-brisson	Brendan Brisson	F	305	\N	\N	\N	\N	\N	2001-10-22	\N	6'0	\N	L	188	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9119	9119	jamie-drysdale
4963	antonio-stranges	Antonio Stranges	F	321	\N	\N	\N	\N	\N	2002-02-05	\N	6'2	\N	L	187	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8459	8459	jamie-drysdale
5082	justin-pearson	Justin Pearson	L	301	\N	\N	\N	\N	\N	1998-05-17	\N	6.01	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9633	9633	jamie-drysdale
5473	josiah-didier	Josiah Didier	D	309	\N	\N	\N	\N	\N	1993-04-08	\N	6.03	\N	R	225	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5889	5889	jamie-drysdale
5005	jack-studnicka	Jack Studnicka	F	299	\N	\N	\N	\N	\N	1999-02-18	\N	6'1	\N	R	187	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7106	7106	jamie-drysdale
212	oskar-pettersson	Oskar Pettersson	R	297	8483673	63	\N	\N	\N	2004-02-04	Halmstad, SWE	6'2	https://assets.nhle.com/mugs/nhl/latest/168x168/8483673.png	R	209	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10016	10016	jamie-drysdale
5155	riese-gaber	Riese Gaber	F	299	\N	\N	\N	\N	\N	1999-10-10	\N	5.08	\N	R	165	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10110	10110	jamie-drysdale
247	david-jiricek	David Jiricek	D	310	8483460	5	\N	\N	\N	2003-11-28	Klatovy, CZE	6'4	https://assets.nhle.com/mugs/nhl/latest/168x168/8483460.png	R	204	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9545	9545	jamie-drysdale
449	marc-gatcomb	Marc Gatcomb	F	326	8483553	17	\N	\N	\N	1999-07-22	Woburn, Massachusetts, USA	6'2	https://assets.nhle.com/mugs/nhl/latest/168x168/8483553.png	R	200	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9091	9091	jamie-drysdale
5181	jakub-stancl	Jakub Stancl	F	319	\N	\N	\N	\N	\N	2005-04-10	\N	6'3	\N	L	217	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10532	10532	jamie-drysdale
480	ivan-miroshnichenko	Ivan Miroshnichenko	L	307	8483491	63	\N	\N	\N	2004-02-04	Ussuriysk, RUS	6'1	https://assets.nhle.com/mugs/nhl/latest/168x168/8483491.png	R	185	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9972	9972	jamie-drysdale
5184	nikita-novikov	Nikita Novikov	D	313	\N	\N	\N	\N	\N	2003-07-25	\N	6'5	\N	L	222	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9930	9930	jamie-drysdale
593	dennis-gilbert	Dennis Gilbert	D	297	8478502	8	\N	\N	\N	1996-10-30	Buffalo, New York, USA	6'2	https://assets.nhle.com/mugs/nhl/latest/168x168/8478502.png	L	216	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7145	7145	jamie-drysdale
666	oliver-moore	Oliver Moore	F	316	8484197	11	\N	\N	\N	2005-01-22	Mounds View, Minnesota, USA	5'11	https://assets.nhle.com/mugs/nhl/latest/168x168/8484197.png	L	188	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10891	10891	jamie-drysdale
682	zakhar-bardakov	Zakhar Bardakov	L	303	8482947	93	\N	\N	\N	2001-02-24	Berdsk, RUS	6'2	https://assets.nhle.com/mugs/nhl/latest/168x168/8482947.png	L	198	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10952	10952	jamie-drysdale
174	jaroslav-chmelar	Jaroslav Chmelar	F	305	8482877	49	\N	\N	\N	2003-07-20	Nove Mesto nad Metuji, CZE	6'4	https://assets.nhle.com/mugs/nhl/latest/168x168/8482877.png	R	226	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10062	10062	jamie-drysdale
674	ethan-del-mastro	Ethan Del Mastro	D	316	8482807	38	\N	\N	\N	2003-01-15	Burlington, Ontario, CAN	6'4	https://assets.nhle.com/mugs/nhl/latest/168x168/8482807.png	L	210	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9833	9833	jamie-drysdale
595	vsevolod-komarov	Vsevolod Komarov	D	315	8483732	76	\N	\N	\N	2004-01-11	Chelyabinsk, RUS	6'4	https://assets.nhle.com/mugs/nhl/latest/168x168/8483732.png	R	211	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10436	10436	jamie-drysdale
201	tyler-boucher	Tyler Boucher	R	297	8482674	54	\N	\N	\N	2003-01-16	Scottsdale, Arizona, USA	6'2	https://assets.nhle.com/mugs/nhl/latest/168x168/8482674.png	R	216	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8987	8987	jamie-drysdale
451	alexander-holtz	Alexander Holtz	F	306	8482125	10	\N	\N	\N	2002-01-23	Stockholm, SWE	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8482125.png	R	198	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8711	8711	jamie-drysdale
463	jeremy-davies	Jeremy Davies	D	306	8479602	84	\N	\N	\N	1996-12-04	Sainte-Anne-de-Bellevue, Quebec, CAN	5'11	https://assets.nhle.com/mugs/nhl/latest/168x168/8479602.png	L	190	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7926	7926	jamie-drysdale
579	konsta-helenius	Konsta Helenius	F	315	8484797	94	\N	\N	\N	2006-05-11	Ylojarvi, FIN	5'11	https://assets.nhle.com/mugs/nhl/latest/168x168/8484797.png	R	190	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10444	10444	jamie-drysdale
544	corey-schueneman	Corey Schueneman	D	307	8481461	\N	\N	\N	\N	1995-09-02	Milford, Michigan, USA	5'11	https://assets.nhle.com/mugs/nhl/latest/168x168/8481461.png	L	204	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7545	7545	jamie-drysdale
339	logan-mailloux	Logan Mailloux	D	319	8482733	23	\N	\N	\N	2003-04-15	Belle River, Ontario, CAN	6'3	https://assets.nhle.com/mugs/nhl/latest/168x168/8482733.png	R	212	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9860	9860	jamie-drysdale
191	vincent-iorio	Vincent Iorio	D	318	8482861	6	\N	\N	\N	2002-11-14	Coquitlam, British Columbia, CAN	6'4	https://assets.nhle.com/mugs/nhl/latest/168x168/8482861.png	R	220	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9165	9165	jamie-drysdale
455	raphael-lavoie	Raphael Lavoie	F	306	8481534	36	\N	\N	\N	2000-09-25	Chambly, Quebec, CAN	6'4	https://assets.nhle.com/mugs/nhl/latest/168x168/8481534.png	R	217	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8663	8663	jamie-drysdale
521	judd-caulfield	Judd Caulfield	R	317	8481538	75	\N	\N	\N	2001-03-19	Grand Forks, North Dakota, USA	6'3	https://assets.nhle.com/mugs/nhl/latest/168x168/8481538.png	R	220	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9702	9702	jamie-drysdale
536	tim-washe	Tim Washe	F	317	8485512	42	\N	\N	\N	2001-08-25	Detroit, Michigan, USA	6'3	https://assets.nhle.com/mugs/nhl/latest/168x168/8485512.png	L	212	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10686	10686	jamie-drysdale
5218	lucas-condotta	Lucas Condotta	L	309	\N	\N	\N	\N	\N	1997-11-06	\N	6'1	\N	L	218	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9093	9093	jamie-drysdale
5117	gracyn-sawchyn	Gracyn Sawchyn	C	299	\N	\N	\N	\N	\N	2005-01-19	\N	5'11	\N	R	157	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10087	10087	jamie-drysdale
5178	guillaume-richard	Guillaume Richard	D	301	\N	\N	\N	\N	\N	2003-02-10	\N	6'2	\N	L	170	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10556	10556	jamie-drysdale
635	sebastian-aho	Sebastian Aho	D	325	8478427	20	\N	\N	\N	1996-02-17	Rauma, FIN	5'10	https://assets.nhle.com/mugs/nhl/latest/168x168/8478427.png	L	180	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6845	6845	jamie-drysdale
5180	jacob-melanson	Jacob Melanson	F	302	\N	\N	\N	\N	\N	2003-04-22	\N	6'0	\N	R	207	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9762	9762	jamie-drysdale
436	victor-mancini	Victor Mancini	D	295	8483768	90	\N	\N	\N	2002-05-26	Hancock, Michigan, USA	6'3	https://assets.nhle.com/mugs/nhl/latest/168x168/8483768.png	R	229	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10090	10090	jamie-drysdale
4922	lleyton-roed	Lleyton Roed	F	302	\N	\N	\N	\N	\N	2002-08-08	\N	6'0	\N	L	179	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10083	10083	jamie-drysdale
4951	francesco-pinelli	Francesco Pinelli	F	313	\N	\N	\N	\N	\N	2003-04-11	\N	6'0	\N	L	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9239	9239	jamie-drysdale
4974	joey-anderson	Joey Anderson	R	316	\N	\N	\N	\N	\N	1998-06-19	\N	6'0	\N	R	207	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7297	7297	jamie-drysdale
4874	tyson-jugnauth	Tyson Jugnauth	D	302	\N	\N	\N	\N	\N	2004-04-17	\N	5'11	\N	L	183	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10190	10190	jamie-drysdale
5021	oskar-olausson	Oskar Olausson	F	308	\N	\N	\N	\N	\N	2002-11-10	\N	6'1	\N	L	180	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9154	9154	jamie-drysdale
5039	filip-mesar	Filip Mesar	R	309	\N	\N	\N	\N	\N	2004-01-03	\N	5'10	\N	R	184	\N	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9522	9522	jamie-drysdale
5062	lucas-carlsson	Lucas Carlsson	D	318	\N	\N	\N	\N	\N	1997-07-05	\N	6'0	\N	L	190	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7434	7434	jamie-drysdale
5083	kale-clague	Kale Clague	D	311	\N	\N	\N	\N	\N	1998-06-05	\N	6'0	\N	L	190	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7152	7152	jamie-drysdale
5103	maxence-guenette	Maxence Guenette	D	310	\N	\N	\N	\N	\N	2001-04-28	\N	6'1	\N	R	210	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7788	7788	jamie-drysdale
5127	tanner-molendyk	Tanner Molendyk	D	312	\N	\N	\N	\N	\N	2005-02-03	\N	6'0	\N	L	190	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10890	10890	jamie-drysdale
5284	david-gucciardi	David Gucciardi	D	307	\N	\N	\N	\N	\N	2002-10-09	\N	6'1	\N	L	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10573	10573	jamie-drysdale
5307	julien-gauthier	Julien Gauthier	R	319	\N	\N	\N	\N	\N	1997-10-15	\N	6'4	\N	R	230	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6828	6828	jamie-drysdale
5335	maros-jedlicka	Maros Jedlicka	F	303	\N	\N	\N	\N	\N	2002-10-23	\N	6'2	\N	L	194	\N	SVK	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10161	10161	jamie-drysdale
5369	blake-smith	Blake Smith	D	322	\N	\N	\N	\N	\N	2004-10-05	\N	6'4	\N	L	211	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10635	10635	jamie-drysdale
5408	vladislav-kolyachonok	Vladislav Kolyachonok	D	321	\N	\N	\N	\N	\N	2001-05-26	\N	6'2	\N	L	198	\N	BLR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8692	8692	jamie-drysdale
5410	austin-roest	Austin Roest	C	312	\N	\N	\N	\N	\N	2004-01-22	\N	5'10	\N	R	184	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9228	9228	jamie-drysdale
5430	riley-bezeau	Riley Bezeau	R	301	\N	\N	\N	\N	\N	2002-05-04	\N	6'0	\N	R	187	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9570	9570	jamie-drysdale
5454	michael-milne	Michael Milne	F	304	\N	\N	\N	\N	\N	2002-09-21	\N	5'11	\N	L	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9347	9347	jamie-drysdale
5482	quinton-burns	Quinton Burns	D	319	\N	\N	\N	\N	\N	2005-04-14	\N	6'2	\N	L	206	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10843	10843	jamie-drysdale
5528	aram-minnetian	Aram Minnetian	D	321	\N	\N	\N	\N	\N	2005-03-19	\N	5'11	\N	R	192	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11004	11004	jamie-drysdale
5621	simon-mack	Simon Mack	D	298	\N	\N	\N	\N	\N	2001-03-29	\N	5.10	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10627	10627	jamie-drysdale
5568	ole-julian-bj-rgvik-holm	OLE JULIAN BJøRGVIK-HOLM	D	301	\N	\N	\N	\N	\N	2002-05-23	\N	6'4	\N	L	204	\N	NOR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8633	8633	jamie-drysdale
5615	paul-ludwinski	Paul Ludwinski	F	316	\N	\N	\N	\N	\N	2004-04-23	\N	5'11	\N	L	172	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9668	9668	jamie-drysdale
5653	drew-callin	Drew Callin	F	314	\N	\N	\N	\N	\N	1995-04-05	\N	6.02	\N	R	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8951	8951	jamie-drysdale
5707	anthony-kehrer	Anthony Kehrer	D	319	\N	\N	\N	\N	\N	2002-03-04	\N	5.11	\N	R	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10516	10516	jamie-drysdale
5746	hunter-johannes	Hunter Johannes	L	310	\N	\N	\N	\N	\N	1998-07-24	\N	6.04	\N	L	225	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10098	10098	jamie-drysdale
5666	josh-lopina	Josh Lopina	C	316	\N	\N	\N	\N	\N	2001-02-16	\N	6'2	\N	R	208	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9082	9082	jamie-drysdale
5587	cooper-gay	Cooper Gay	F	303	\N	\N	\N	\N	\N	2002-03-15	\N	6'4	\N	L	209	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10545	10545	jamie-drysdale
5744	henry-brzustewicz	Henry Brzustewicz	D	313	\N	\N	\N	\N	\N	2007-02-09	\N	6'2	\N	R	203	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10711	10711	jamie-drysdale
5782	ryan-tattle	Ryan Tattle	F	314	\N	\N	\N	\N	\N	2001-09-07	\N	5.10	\N	L	180	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11032	11032	jamie-drysdale
10380	luke-rowe	Luke Rowe	D	326	\N	\N	\N	\N	\N	1998-08-08	\N	6.01	\N	R	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10020	10020	jamie-drysdale
5800	zach-berzolla	Zach Berzolla	D	319	\N	\N	\N	\N	\N	1998-05-28	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8650	8650	jamie-drysdale
4881	sheldon-dries	Sheldon Dries	C	304	\N	\N	\N	\N	\N	1994-04-23	\N	5'10	\N	L	182	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6856	6856	jamie-drysdale
10062	cole-mcward	Cole Mcward	D	326	\N	\N	\N	\N	\N	2001-06-09	\N	6'2	\N	R	196	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9886	9886	jamie-drysdale
10290	aaron-huglen	Aaron Huglen	R	325	\N	\N	\N	\N	\N	2001-03-06	\N	6'1	\N	R	178	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10851	10851	jamie-drysdale
5493	andrew-perrott	Andrew Perrott	D	316	\N	\N	\N	\N	\N	2001-08-24	\N	5.10	\N	R	216	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9341	9341	jamie-drysdale
4847	chris-wagner	Chris Wagner	C	319	\N	\N	\N	\N	\N	1991-05-27	\N	6'0	\N	R	192	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4622	4622	jamie-drysdale
4801	felix-unger-sorum	Felix Unger Sorum	R	300	\N	\N	\N	\N	\N	2005-09-14	\N	6'0	\N	R	190	\N	NOR	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10462	10462	jamie-drysdale
55	hunter-haight	Hunter Haight	F	308	8483452	37	\N	\N	\N	2004-04-04	Strathroy, Ontario, CAN	5'10	https://assets.nhle.com/mugs/nhl/latest/168x168/8483452.png	R	173	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10313	10313	jamie-drysdale
5176	danton-heinen	Danton Heinen	L	301	\N	\N	\N	\N	\N	1995-07-05	\N	6'2	\N	L	187	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6354	6354	jamie-drysdale
4981	david-gustafsson	David Gustafsson	C	311	\N	\N	\N	\N	\N	2000-04-11	\N	6'2	\N	L	196	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7777	7777	jamie-drysdale
4851	philippe-daoust	Philippe Daoust	C	297	\N	\N	\N	\N	\N	2001-11-05	\N	6.01	\N	L	195	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8861	8861	jamie-drysdale
5770	matthew-sop	Matthew Sop	L	308	\N	\N	\N	\N	\N	2003-02-04	\N	6.00	\N	L	183	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10306	10306	jamie-drysdale
10341	pierrick-dube	Pierrick Dube	R	326	\N	\N	\N	\N	\N	2001-01-07	\N	5.09	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9515	9515	jamie-drysdale
5788	tag-bertuzzi	Tag Bertuzzi	F	324	\N	\N	\N	\N	\N	2001-02-18	\N	6.01	\N	L	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9592	9592	jamie-drysdale
5588	d-j-king	D.j. King	D	307	\N	\N	\N	\N	\N	2000-08-07	\N	6.03	\N	L	216	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8445	8445	jamie-drysdale
630	zayne-parekh	Zayne Parekh	D	298	8484768	19	\N	\N	\N	2006-02-15	Markham, Ontario, CAN	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8484768.png	R	179	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10953	10953	jamie-drysdale
5162	cam-dineen	Cam Dineen	D	296	\N	\N	\N	\N	\N	1998-06-19	\N	5'11	\N	L	188	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7159	7159	jamie-drysdale
5012	antti-tuomisto	Antti Tuomisto	D	304	\N	\N	\N	\N	\N	2001-01-20	\N	6'5	\N	R	217	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9973	9973	jamie-drysdale
5055	gavin-hayes	Gavin Hayes	F	316	\N	\N	\N	\N	\N	2004-05-14	\N	6'1	\N	R	177	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9720	9720	jamie-drysdale
5106	patrick-giles	Patrick Giles	F	318	\N	\N	\N	\N	\N	2000-01-03	\N	6'5	\N	R	218	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9040	9040	jamie-drysdale
5150	justin-kirkland	Justin Kirkland	C	298	\N	\N	\N	\N	\N	1996-08-02	\N	6'3	\N	L	183	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6426	6426	jamie-drysdale
5171	aleksi-heimosalmi	Aleksi Heimosalmi	D	300	\N	\N	\N	\N	\N	2003-05-08	\N	6'0	\N	R	181	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10463	10463	jamie-drysdale
5210	billy-sweezey	Billy Sweezey	D	314	\N	\N	\N	\N	\N	1996-02-06	\N	6'1	\N	R	202	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8462	8462	jamie-drysdale
5258	oscar-eklind	Oscar Eklind	F	310	\N	\N	\N	\N	\N	1998-07-14	\N	6'4	\N	L	220	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10432	10432	jamie-drysdale
5295	sonny-milano	Sonny Milano	L	307	\N	\N	\N	\N	\N	1996-05-12	\N	6'0	\N	L	205	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5856	5856	jamie-drysdale
5332	ludvig-jansson	Ludvig Jansson	D	299	\N	\N	\N	\N	\N	2003-12-27	\N	6'0	\N	R	176	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10913	10913	jamie-drysdale
5165	marc-andre-gaudet	Marc-andre Gaudet	D	319	\N	\N	\N	\N	\N	2003-10-24	\N	6'3	\N	L	196	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9868	9868	jamie-drysdale
5413	cavan-fitzgerald	Cavan Fitzgerald	D	316	\N	\N	\N	\N	\N	1996-08-23	\N	6'1	\N	L	190	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6799	6799	jamie-drysdale
5441	eamon-powell	Eamon Powell	D	299	\N	\N	\N	\N	\N	2002-05-10	\N	5'11	\N	R	165	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10582	10582	jamie-drysdale
5358	joel-nystrom	Joel Nystrom	D	300	\N	\N	\N	\N	\N	2002-05-14	\N	5'11	\N	R	178	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10597	10597	jamie-drysdale
5549	jacob-truscott	Jacob Truscott	D	304	\N	\N	\N	\N	\N	2002-04-12	\N	6'1	\N	L	170	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10898	10898	jamie-drysdale
5577	ryan-o-rourke	Ryan O'rourke	D	297	\N	\N	\N	\N	\N	2002-05-16	\N	6'1	\N	L	179	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8554	8554	jamie-drysdale
5635	alfons-freij	Alfons Freij	D	311	\N	\N	\N	\N	\N	2006-02-12	\N	6'1	\N	L	187	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10993	10993	jamie-drysdale
5660	jake-chiasson	Jake Chiasson	R	297	\N	\N	\N	\N	\N	2003-05-25	\N	6'2	\N	R	181	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9938	9938	jamie-drysdale
4873	jordan-oesterle	Jordan Oesterle	D	312	\N	\N	\N	\N	\N	1992-06-25	\N	6'0	\N	L	181	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5489	5489	jamie-drysdale
4994	henrik-rybinski	Henrik Rybinski	C	307	\N	\N	\N	\N	\N	2001-06-26	\N	6'1	\N	R	172	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9356	9356	jamie-drysdale
5657	israel-mianscum	Israel Mianscum	L	309	\N	\N	\N	\N	\N	2003-04-18	\N	6.02	\N	L	202	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10368	10368	jamie-drysdale
465	ville-heinola	Ville Heinola	D	311	8481572	14	\N	\N	\N	2001-03-02	Honkajoki, FIN	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8481572.png	L	181	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7772	7772	jamie-drysdale
5529	arnaud-durandeau	Arnaud Durandeau	L	295	\N	\N	\N	\N	\N	1999-01-14	\N	6.00	\N	L	194	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7189	7189	jamie-drysdale
4938	brian-pinho	Brian Pinho	F	299	\N	\N	\N	\N	\N	1995-05-11	\N	6.01	\N	R	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7337	7337	jamie-drysdale
229	alex-bump	Alex Bump	F	310	8483731	20	\N	\N	\N	2003-11-20	Burnsville, Minnesota, USA	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8483731.png	L	195	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10633	10633	jamie-drysdale
5208	seamus-casey	Seamus Casey	D	324	\N	\N	\N	\N	\N	2004-01-08	\N	5'10	\N	R	181	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10474	10474	jamie-drysdale
5252	kyle-marino	Kyle Marino	R	312	\N	\N	\N	\N	\N	1995-06-01	\N	6'3	\N	R	220	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8825	8825	jamie-drysdale
13	josh-samanski	Josh Samanski	C	296	8484509	81	\N	\N	\N	2002-03-22	Erding, DEU	6'2	https://assets.nhle.com/mugs/nhl/latest/168x168/8484509.png	L	195	\N	DEU	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10877	10877	jamie-drysdale
676	kevin-korchinski	Kevin Korchinski	D	316	8483466	14	\N	\N	\N	2004-06-21	Saskatoon, Saskatchewan, CAN	6'1	https://assets.nhle.com/mugs/nhl/latest/168x168/8483466.png	L	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10382	10382	jamie-drysdale
678	sam-rinzel	Sam Rinzel	D	316	8483506	6	\N	\N	\N	2004-06-25	Chanhassen, Minnesota, USA	6'4	https://assets.nhle.com/mugs/nhl/latest/168x168/8483506.png	R	194	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10939	10939	jamie-drysdale
37	taylor-ward	Taylor Ward	F	313	8483406	52	\N	\N	\N	1998-03-31	Kelowna, British Columbia, CAN	6'2	https://assets.nhle.com/mugs/nhl/latest/168x168/8483406.png	R	215	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9043	9043	jamie-drysdale
5010	wyatt-bongiovanni	Wyatt Bongiovanni	C	307	\N	\N	\N	\N	\N	1999-07-24	\N	6'0	\N	L	197	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9142	9142	jamie-drysdale
4924	nicolas-aube-kubel	Nicolas Aube-kubel	R	308	\N	\N	\N	\N	\N	1996-05-10	\N	6'0	\N	R	213	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6304	6304	jamie-drysdale
5051	cam-lund	Cam Lund	F	318	\N	\N	\N	\N	\N	2004-06-07	\N	6'2	\N	R	195	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10692	10692	jamie-drysdale
5072	alexis-gendron	Alexis Gendron	F	314	\N	\N	\N	\N	\N	2003-12-30	\N	5'9	\N	L	175	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9825	9825	jamie-drysdale
5105	olivier-nadeau	Olivier Nadeau	R	315	\N	\N	\N	\N	\N	2003-01-15	\N	6'1	\N	R	197	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9761	9761	jamie-drysdale
5135	david-edstrom	David Edstrom	C	312	\N	\N	\N	\N	\N	2005-02-18	\N	6'4	\N	L	193	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10645	10645	jamie-drysdale
5056	ivan-ivan	Ivan Ivan	F	303	\N	\N	\N	\N	\N	2002-08-20	\N	6'0	\N	L	190	\N	CZE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9969	9969	jamie-drysdale
5297	ashton-sautner	Ashton Sautner	D	311	\N	\N	\N	\N	\N	1994-05-27	\N	6'1	\N	L	192	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5929	5929	jamie-drysdale
5333	lukas-dragicevic	Lukas Dragicevic	D	302	\N	\N	\N	\N	\N	2005-04-25	\N	6'1	\N	R	206	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10082	10082	jamie-drysdale
5393	daniel-walcott	Daniel Walcott	L	305	\N	\N	\N	\N	\N	1994-02-19	\N	6'0	\N	L	175	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5944	5944	jamie-drysdale
5421	jacob-julien	Jacob Julien	C	311	\N	\N	\N	\N	\N	2004-09-12	\N	6'4	\N	L	181	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10907	10907	jamie-drysdale
5467	dennis-cholowski	Dennis Cholowski	D	324	\N	\N	\N	\N	\N	1998-02-15	\N	6'2	\N	L	210	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6734	6734	jamie-drysdale
5523	vitali-kravtsov	Vitali Kravtsov	R	295	\N	\N	\N	\N	\N	1999-12-23	\N	6'3	\N	L	186	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7956	7956	jamie-drysdale
5551	john-prokop	John Prokop	D	322	\N	\N	\N	\N	\N	2001-05-13	\N	6'3	\N	L	195	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10513	10513	jamie-drysdale
5599	jesse-kiiskinen	Jesse Kiiskinen	R	304	\N	\N	\N	\N	\N	2005-08-23	\N	6'2	\N	R	197	\N	FIN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11068	11068	jamie-drysdale
5471	jacob-perreault	Jacob Perreault	R	314	\N	\N	\N	\N	\N	2002-04-15	\N	5.11	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8386	8386	jamie-drysdale
5507	elliot-desnoyers	Elliot Desnoyers	L	308	\N	\N	\N	\N	\N	2002-01-21	\N	5.11	\N	L	186	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9381	9381	jamie-drysdale
5638	braden-birnie	Braden Birnie	L	295	\N	\N	\N	\N	\N	2001-10-19	\N	6.02	\N	L	195	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11039	11039	jamie-drysdale
5655	hoyt-stanley	Hoyt Stanley	D	297	\N	\N	\N	\N	\N	2005-02-04	\N	6'3	\N	R	204	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11034	11034	jamie-drysdale
5585	colin-ralph	Colin Ralph	D	319	\N	\N	\N	\N	\N	2005-10-04	\N	6'4	\N	L	216	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11055	11055	jamie-drysdale
5775	rieger-lorenz	Rieger Lorenz	L	308	\N	\N	\N	\N	\N	2004-03-30	\N	6'1	\N	L	184	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11085	11085	jamie-drysdale
5700	william-nicholl	William Nicholl	C	296	\N	\N	\N	\N	\N	2006-05-24	\N	6'0	\N	L	184	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11064	11064	jamie-drysdale
5145	brett-harrison	Brett Harrison	R	310	\N	\N	\N	\N	\N	2003-06-07	\N	6'3	\N	L	201	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9166	9166	jamie-drysdale
10204	finn-harding	Finn Harding	D	325	\N	\N	\N	\N	\N	2005-03-02	\N	6'1	\N	R	214	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10848	10848	jamie-drysdale
5057	jackson-hallum	Jackson Hallum	F	306	\N	\N	\N	\N	\N	2002-09-08	\N	6'0	\N	L	190	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10680	10680	jamie-drysdale
5433	simon-robertsson	Simon Robertsson	F	319	\N	\N	\N	\N	\N	2003-02-05	\N	6'0	\N	L	197	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10330	10330	jamie-drysdale
5765	lucas-pettersson	Lucas Pettersson	C	317	\N	\N	\N	\N	\N	2006-04-17	\N	5'11	\N	L	168	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11046	11046	jamie-drysdale
4877	bogdan-trineyev	Bogdan Trineyev	R	307	\N	\N	\N	\N	\N	2002-03-04	\N	6'3	\N	R	198	\N	RUS	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9161	9161	jamie-drysdale
4893	matthew-poitras	Matthew Poitras	C	314	\N	\N	\N	\N	\N	2004-03-10	\N	6'0	\N	R	189	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9729	9729	jamie-drysdale
5291	kaden-hammell	Kaden Hammell	D	302	\N	\N	\N	\N	\N	2005-03-12	\N	6'1	\N	R	187	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10179	10179	jamie-drysdale
5537	charle-edouard-d-astous	Charle-edouard D'astous	D	320	\N	\N	\N	\N	\N	1998-04-21	\N	6'2	\N	L	211	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8057	8057	jamie-drysdale
4806	alex-belzile	Alex Belzile	F	309	\N	\N	\N	\N	\N	1991-08-31	\N	6'0	\N	R	198	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4819	4819	jamie-drysdale
5244	alex-kannok-leipert	Alex Kannok Leipert	D	304	\N	\N	\N	\N	\N	2000-07-20	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8927	8927	jamie-drysdale
5729	darick-louis-jean	Darick Louis-jean	D	309	\N	\N	\N	\N	\N	2000-12-07	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10781	10781	jamie-drysdale
5778	roman-kinal	Roman Kinal	D	317	\N	\N	\N	\N	\N	1998-07-20	\N	6.02	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9625	9625	jamie-drysdale
446	trevor-connelly	Trevor Connelly	F	306	8484803	24	\N	\N	\N	2006-02-28	Tustin, California, USA	6'1	https://assets.nhle.com/mugs/nhl/latest/168x168/8484803.png	L	175	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10579	10579	jamie-drysdale
5095	danny-zhilkin	Danny Zhilkin	C	311	\N	\N	\N	\N	\N	2003-12-19	\N	6.01	\N	L	192	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9746	9746	jamie-drysdale
5290	josh-brown	Josh Brown	D	296	\N	\N	\N	\N	\N	1994-01-21	\N	6.05	\N	R	217	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6058	6058	jamie-drysdale
5398	jarred-tinordi	Jarred Tinordi	D	320	\N	\N	\N	\N	\N	1992-02-20	\N	6.06	\N	L	230	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4666	4666	jamie-drysdale
5420	graham-slaggert	Graham Slaggert	L	315	\N	\N	\N	\N	\N	1999-04-06	\N	5.11	\N	L	183	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9078	9078	jamie-drysdale
5442	ethan-keppen	Ethan Keppen	R	296	\N	\N	\N	\N	\N	2001-03-20	\N	6.02	\N	L	203	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8696	8696	jamie-drysdale
5511	jacob-doty	Jacob Doty	F	313	\N	\N	\N	\N	\N	1993-06-19	\N	6.04	\N	R	230	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5592	5592	jamie-drysdale
5545	gustav-stjernberg	Gustav Stjernberg	D	303	\N	\N	\N	\N	\N	2002-10-12	\N	6.04	\N	R	208	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10984	10984	jamie-drysdale
5557	kyler-kupka	Kyler Kupka	C	307	\N	\N	\N	\N	\N	1999-05-11	\N	6.00	\N	L	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10345	10345	jamie-drysdale
5676	matthew-savoie	Matthew Savoie	R	296	\N	\N	\N	\N	\N	2004-01-01	\N	5.10	\N	R	179	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9765	9765	jamie-drysdale
5708	anthony-romano	Anthony Romano	F	319	\N	\N	\N	\N	\N	2000-10-07	\N	5.11	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10024	10024	jamie-drysdale
5767	luke-mistelbacher	Luke Mistelbacher	R	297	\N	\N	\N	\N	\N	2005-11-02	\N	6.00	\N	R	200	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10598	10598	jamie-drysdale
10469	c-j-smith	C.j. Smith	F	326	\N	\N	\N	\N	\N	1994-12-01	\N	5.11	\N	L	178	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6858	6858	jamie-drysdale
10910	sean-larochelle	Sean Larochelle	D	311	\N	\N	\N	\N	\N	2001-02-11	\N	5.10	\N	R	170	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10969	10969	jamie-drysdale
5668	keaton-mastrodonato	Keaton Mastrodonato	F	313	\N	\N	\N	\N	\N	1999-02-13	\N	6.00	\N	R	205	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9663	9663	jamie-drysdale
454	tanner-laczynski	Tanner Laczynski	F	306	8479550	28	\N	\N	\N	1997-06-01	Minooka, Illinois, USA	6'1	https://assets.nhle.com/mugs/nhl/latest/168x168/8479550.png	R	211	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8448	8448	jamie-drysdale
362	charle-edouard-dastous	Charle-Edouard D'Astous	D	32	8480426	51	\N	\N	\N	1998-04-21	Rimouski, Quebec, CAN	6.02	https://assets.nhle.com/mugs/nhl/latest/168x168/8480426.png	L	211	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8057	8057	jamie-drysdale
374	luke-haymes	Luke Haymes	C	322	8485467	43	\N	\N	\N	2003-07-28	Ottawa, Ontario, CAN	6'1	https://assets.nhle.com/mugs/nhl/latest/168x168/8485467.png	L	192	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10525	10525	jamie-drysdale
46	scott-perunovich	Scott Perunovich	D	323	8481059	\N	\N	\N	\N	1998-08-18	Hibbing, Minnesota, USA	5'10	https://assets.nhle.com/mugs/nhl/latest/168x168/8481059.png	L	175	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=8519	8519	jamie-drysdale
5705	andre-anania	Andre Anania	D	312	\N	\N	\N	\N	\N	2003-03-02	\N	\N	\N	\N	\N	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10888	10888	jamie-drysdale
5436	aaron-ness	Aaron Ness	D	307	\N	\N	\N	\N	\N	1990-05-18	\N	5 ' 10"	\N	left	183	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4026	4026	jamie-drysdale
5063	marc-johnstone	Marc Johnstone	R	322	\N	\N	\N	\N	\N	1996-06-19	\N	6.00	\N	R	192	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9023	9023	jamie-drysdale
5379	jujhar-khaira	Jujhar Khaira	C	295	\N	\N	\N	\N	\N	1994-08-13	\N	6.05	\N	L	214	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5502	5502	jamie-drysdale
5465	cooper-walker	Cooper Walker	C	295	\N	\N	\N	\N	\N	2002-07-11	\N	6.00	\N	R	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10013	10013	jamie-drysdale
5496	brandon-baddock	Brandon Baddock	L	322	\N	\N	\N	\N	\N	1995-03-29	\N	6.03	\N	L	219	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5926	5926	jamie-drysdale
5499	chad-hillebrand	Chad Hillebrand	L	304	\N	\N	\N	\N	\N	1999-01-22	\N	6.04	\N	L	201	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10108	10108	jamie-drysdale
5519	reece-newkirk	Reece Newkirk	F	320	\N	\N	\N	\N	\N	2001-02-20	\N	5.11	\N	L	180	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7821	7821	jamie-drysdale
5564	max-wanner	Max Wanner	D	314	\N	\N	\N	\N	\N	2003-03-12	\N	6.03	\N	R	202	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9945	9945	jamie-drysdale
5603	kevin-conley	Kevin Conley	C	311	\N	\N	\N	\N	\N	1997-02-17	\N	6.01	\N	L	198	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9343	9343	jamie-drysdale
5610	michael-koster	Michael Koster	D	308	\N	\N	\N	\N	\N	2001-04-13	\N	5.10	\N	R	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10940	10940	jamie-drysdale
5612	nicky-leivermann	Nicky Leivermann	D	307	\N	\N	\N	\N	\N	1998-09-14	\N	5.11	\N	L	185	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9817	9817	jamie-drysdale
5675	matthew-brown	Matthew Brown	F	296	\N	\N	\N	\N	\N	1999-08-09	\N	5.09	\N	L	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9728	9728	jamie-drysdale
5695	travis-howe	Travis Howe	R	317	\N	\N	\N	\N	\N	1994-02-10	\N	6.02	\N	R	190	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7309	7309	jamie-drysdale
5724	christian-fitzgerald	Christian Fitzgerald	F	321	\N	\N	\N	\N	\N	2002-05-31	\N	6.00	\N	L	186	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11084	11084	jamie-drysdale
5751	jacob-hudson	Jacob Hudson	F	314	\N	\N	\N	\N	\N	2000-12-02	\N	5.08	\N	R	179	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10348	10348	jamie-drysdale
5797	will-mackinnon	Will Mackinnon	D	301	\N	\N	\N	\N	\N	2000-04-13	\N	5.11	\N	L	201	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9375	9375	jamie-drysdale
10720	scooter-brickey	Scooter Brickey	D	325	\N	\N	\N	\N	\N	1999-05-27	\N	6.04	\N	R	215	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10042	10042	jamie-drysdale
10825	brayden-edwards	Brayden Edwards	F	325	\N	\N	\N	\N	\N	2004-12-23	\N	6.01	\N	R	188	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10854	10854	jamie-drysdale
5520	riley-thompson	Riley Thompson	C	310	\N	\N	\N	\N	\N	2002-08-17	\N	6.04	\N	R	222	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=11015	11015	jamie-drysdale
5687	rhett-parsons	Rhett Parsons	D	322	\N	\N	\N	\N	\N	2003-10-10	\N	6.03	\N	R	210	\N	\N	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10425	10425	jamie-drysdale
713	mathieu-olivier	Mathieu Olivier	R	14	8479671	24	\N	\N	\N	1997-02-11	Biloxi, Mississippi, USA	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8479671.png	R	232	\N	USA	\N	\N	\N
344	anthony-cirelli	Anthony Cirelli	C	32	8478519	71	\N	\N	\N	1997-07-15	Etobicoke, Ontario, CAN	6'1"	https://assets.nhle.com/mugs/nhl/latest/168x168/8478519.png	L	193	\N	CAN	\N	\N	\N
535	anton-wahlberg	Anton Wahlberg	L	315	8484238	\N	\N	\N	\N	2005-07-04	Malmo, SWE	6'4	https://assets.nhle.com/mugs/nhl/latest/168x168/8484238.png	L	205	\N	SWE	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10052	10052	jamie-drysdale
136	jack-hughes	Jack Hughes	F	313	8481559	86	\N	\N	\N	2001-05-14	Orlando, Florida, USA	5'11	https://assets.nhle.com/mugs/nhl/latest/168x168/8481559.png	L	175	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10715	10715	jamie-drysdale
209	stephen-halliday	Stephen Halliday	C	297	8483676	83	\N	\N	\N	2002-07-02	Ajax, Ontario, CAN	6'4	https://assets.nhle.com/mugs/nhl/latest/168x168/8483676.png	L	214	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10048	10048	jamie-drysdale
476	ethen-frank	Ethen Frank	R	307	8483573	53	\N	\N	\N	1998-02-05	Aurora, Colorado, USA	5'11	https://assets.nhle.com/mugs/nhl/latest/168x168/8483573.png	R	188	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9112	9112	jamie-drysdale
413	maveric-lamoureux	Maveric Lamoureux	D	323	8483472	10	\N	\N	\N	2004-01-13	Laval, Quebec, CAN	6'6	https://assets.nhle.com/mugs/nhl/latest/168x168/8483472.png	R	196	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10220	10220	jamie-drysdale
286	michael-misa	Michael Misa	F	318	8485402	77	\N	\N	\N	2007-02-16	Oakville, Ontario, CAN	6'1	https://assets.nhle.com/mugs/nhl/latest/168x168/8485402.png	L	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10693	10693	jamie-drysdale
741	kyle-capobianco	Kyle Capobianco	D	321	8478476	20	\N	\N	\N	1997-08-13	Mississauga, Ontario, CAN	6'3	https://assets.nhle.com/mugs/nhl/latest/168x168/8478476.png	L	194	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6718	6718	jamie-drysdale
234	jacob-gaucher	Jacob Gaucher	F	310	8481848	78	\N	\N	\N	2001-03-09	Longueuil, Quebec, CAN	6'3	https://assets.nhle.com/mugs/nhl/latest/168x168/8481848.png	R	185	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9378	9378	jamie-drysdale
4832	brett-seney	Brett Seney	F	316	\N	\N	\N	\N	\N	1996-02-28	\N	5'9	https://www.hockeydb.com/ihdb/photos/brett-sonne-2013-36.jpg	L	156	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7027	7027	jamie-drysdale
4891	luca-cagnoni	Luca Cagnoni	D	318	\N	\N	\N	\N	\N	2004-12-21	\N	5'9	https://www.hockeydb.com/ihdb/photos/luca-cagnoni-2026-44.jpg	L	180	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=10226	10226	jamie-drysdale
8	max-jones	Max Jones	L	296	8479368	46	\N	\N	\N	1998-02-17	Rochester, Michigan, USA	6'3	https://assets.nhle.com/mugs/nhl/latest/168x168/8479368.png	L	216	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=6780	6780	jamie-drysdale
564	jonathan-aspirot	Jonathan Aspirot	D	314	8481219	45	\N	\N	\N	1999-05-16	Mascouche, Quebec, CAN	6'0	https://assets.nhle.com/mugs/nhl/latest/168x168/8481219.png	L	212	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=7786	7786	jamie-drysdale
4821	jayson-megna	Jayson Megna	F	303	\N	\N	\N	\N	\N	1990-02-01	\N	6'0	https://www.hockeydb.com/ihdb/photos/jaycob-megna-2026-7776.jpg	R	190	\N	USA	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4584	4584	jamie-drysdale
287	zack-ostapchuk	Zack Ostapchuk	C	318	8482859	63	\N	\N	\N	2003-05-29	St. Albert, Alberta, CAN	6'4	https://assets.nhle.com/mugs/nhl/latest/168x168/8482859.png	L	212	\N	CAN	https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=9832	9832	jamie-drysdale
\.


--
-- Data for Name: Team; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Team" (id, slug, name, gm, arena, code, league, "parentTeamId", "eliteProspectsUrl") FROM stdin;
18	florida-panthers	Florida Panthers	Unassigned	Amerant Bank Arena	FLA	NHL	\N	\N
19	los-angeles-kings	Los Angeles Kings	Unassigned	Crypto.com Arena	LAK	NHL	\N	\N
20	minnesota-wild	Minnesota Wild	Unassigned	Xcel Energy Center	MIN	NHL	\N	\N
21	montreal-canadiens	Montreal Canadiens	Unassigned	Bell Centre	MTL	NHL	\N	\N
22	nashville-predators	Nashville Predators	Unassigned	Bridgestone Arena	NSH	NHL	\N	\N
23	new-jersey-devils	New Jersey Devils	Unassigned	Prudential Center	NJD	NHL	\N	\N
24	new-york-islanders	New York Islanders	Unassigned	UBS Arena	NYI	NHL	\N	\N
25	new-york-rangers	New York Rangers	Unassigned	Madison Square Garden	NYR	NHL	\N	\N
26	ottawa-senators	Ottawa Senators	Unassigned	Canadian Tire Centre	OTT	NHL	\N	\N
27	philadelphia-flyers	Philadelphia Flyers	Unassigned	Wells Fargo Center	PHI	NHL	\N	\N
28	pittsburgh-penguins	Pittsburgh Penguins	Unassigned	PPG Paints Arena	PIT	NHL	\N	\N
29	san-jose-sharks	San Jose Sharks	Unassigned	SAP Center	SJS	NHL	\N	\N
30	seattle-kraken	Seattle Kraken	Unassigned	Climate Pledge Arena	SEA	NHL	\N	\N
31	st-louis-blues	St. Louis Blues	Unassigned	Enterprise Center	STL	NHL	\N	\N
32	tampa-bay-lightning	Tampa Bay Lightning	Unassigned	Amalie Arena	TBL	NHL	\N	\N
2	toronto-maple-leafs	Toronto Maple Leafs	Unknown	Scotiabank Arena	TOR	NHL	\N	\N
34	utah-mammoth	Utah Mammoth	Unassigned	Delta Center	UTA	NHL	\N	\N
35	vancouver-canucks	Vancouver Canucks	Unassigned	Rogers Arena	VAN	NHL	\N	\N
36	vegas-golden-knights	Vegas Golden Knights	Unassigned	T-Mobile Arena	VGK	NHL	\N	\N
37	washington-capitals	Washington Capitals	Unassigned	Capital One Arena	WSH	NHL	\N	\N
38	winnipeg-jets	Winnipeg Jets	Unassigned	Canada Life Centre	WPG	NHL	\N	\N
295	abbotsford-canucks	Abbotsford Canucks	Unassigned	TBD	\N	AHL	35	\N
296	bakersfield-condors	Bakersfield Condors	Unassigned	TBD	\N	AHL	1	\N
297	belleville-senators	Belleville Senators	Unassigned	TBD	\N	AHL	26	\N
298	calgary-wranglers	Calgary Wranglers	Unassigned	TBD	\N	AHL	10	\N
299	charlotte-checkers	Charlotte Checkers	Unassigned	TBD	\N	AHL	18	\N
300	chicago-wolves	Chicago Wolves	Unassigned	TBD	\N	AHL	11	\N
301	cleveland-monsters	Cleveland Monsters	Unassigned	TBD	\N	AHL	14	\N
302	coachella-valley-firebirds	Coachella Valley Firebirds	Unassigned	TBD	\N	AHL	30	\N
303	colorado-eagles	Colorado Eagles	Unassigned	TBD	\N	AHL	13	\N
304	grand-rapids-griffins	Grand Rapids Griffins	Unassigned	TBD	\N	AHL	16	\N
305	hartford-wolf-pack	Hartford Wolf Pack	Unassigned	TBD	\N	AHL	25	\N
306	henderson-silver-knights	Henderson Silver Knights	Unassigned	TBD	\N	AHL	36	\N
307	hershey-bears	Hershey Bears	Unassigned	TBD	\N	AHL	37	\N
308	iowa-wild	Iowa Wild	Unassigned	TBD	\N	AHL	20	\N
309	laval-rocket	Laval Rocket	Unassigned	TBD	\N	AHL	21	\N
310	lehigh-valley-phantoms	Lehigh Valley Phantoms	Unassigned	TBD	\N	AHL	27	\N
311	manitoba-moose	Manitoba Moose	Unassigned	TBD	\N	AHL	38	\N
312	milwaukee-admirals	Milwaukee Admirals	Unassigned	TBD	\N	AHL	22	\N
313	ontario-reign	Ontario Reign	Unassigned	TBD	\N	AHL	19	\N
314	providence-bruins	Providence Bruins	Unassigned	TBD	\N	AHL	3	\N
315	rochester-americans	Rochester Americans	Unassigned	TBD	\N	AHL	9	\N
316	rockford-icehogs	Rockford IceHogs	Unassigned	TBD	\N	AHL	12	\N
317	san-diego-gulls	San Diego Gulls	Unassigned	TBD	\N	AHL	7	\N
318	san-jose-barracuda	San Jose Barracuda	Unassigned	TBD	\N	AHL	29	\N
319	springfield-thunderbirds	Springfield Thunderbirds	Unassigned	TBD	\N	AHL	31	\N
320	syracuse-crunch	Syracuse Crunch	Unassigned	TBD	\N	AHL	32	\N
321	texas-stars	Texas Stars	Unassigned	TBD	\N	AHL	15	\N
322	toronto-marlies	Toronto Marlies	Unassigned	TBD	\N	AHL	2	\N
323	tucson-roadrunners	Tucson Roadrunners	Unassigned	TBD	\N	AHL	34	\N
324	utica-comets	Utica Comets	Unassigned	TBD	\N	AHL	23	\N
325	wilkes-barre-scranton-penguins	Wilkes-Barre Scranton Penguins	Unassigned	TBD	\N	AHL	28	\N
326	hamilton-hammers	Hamilton Hammers	TBD	Hamilton Arena	\N	AHL	\N	\N
7	anaheim-ducks	Anaheim Ducks	Unassigned	Honda Center	ANA	NHL	\N	\N
3	boston-bruins	Boston Bruins	Unknown	TD Garden	BOS	NHL	\N	\N
9	buffalo-sabres	Buffalo Sabres	Unassigned	KeyBank Center	BUF	NHL	\N	\N
10	calgary-flames	Calgary Flames	Unassigned	Scotiabank Saddledome	CGY	NHL	\N	\N
11	carolina-hurricanes	Carolina Hurricanes	Unassigned	Lenovo Center	CAR	NHL	\N	\N
12	chicago-blackhawks	Chicago Blackhawks	Unassigned	United Center	CHI	NHL	\N	\N
13	colorado-avalanche	Colorado Avalanche	Unassigned	Ball Arena	COL	NHL	\N	\N
14	columbus-blue-jackets	Columbus Blue Jackets	Unassigned	Nationwide Arena	CBJ	NHL	\N	\N
15	dallas-stars	Dallas Stars	Unassigned	American Airlines Center	DAL	NHL	\N	\N
16	detroit-red-wings	Detroit Red Wings	Unassigned	Little Caesars Arena	DET	NHL	\N	\N
1	edmonton-oilers	Edmonton Oilers	Ladislav Mozolic	Rogers Place	EDM	NHL	\N	\N
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
\.


--
-- Name: Player_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Player_id_seq"', 13126, true);


--
-- Name: Team_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Team_id_seq"', 328, true);


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

\unrestrict djvCD1LnO7jUh3SUqYRwc0pUJxZ00Q5LvLFRCvtGMJFRLjopambgS2NjOGdXAfC

