--
-- PostgreSQL database dump
--

\restrict GL5E7ahivl4Oy3ZthPVRHhL2bJGgDoJkw02cPqjUa0QkvFVbYswOiJTqXkBmHVs

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
    weight integer
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

COPY public."Player" (id, slug, name, "position", "teamId", "nhlId", number, "capHit", "contractExpiry", "contractYears", "birthDate", "birthPlace", height, "photoUrl", shoots, weight) FROM stdin;
13	josh-samanski	JOSH SAMANSKI	C	296	8484509	81	\N	\N	\N	\N	\N	\N	\N	\N	\N
99	david-reinbacher	DAVID REINBACHER	D	309	8484220	64	\N	\N	\N	\N	\N	\N	\N	\N	\N
37	taylor-ward	TAYLOR WARD	F	313	8483406	52	\N	\N	\N	\N	\N	\N	\N	\N	\N
12	vasily-podkolzin	Vasily Podkolzin	R	1	8481617	92	\N	\N	\N	\N	\N	\N	\N	\N	\N
14	matt-savoie	Matt Savoie	C	1	8483512	22	\N	\N	\N	\N	\N	\N	\N	\N	\N
15	evan-bouchard	Evan Bouchard	D	1	8480803	2	\N	\N	\N	\N	\N	\N	\N	\N	\N
16	mattias-ekholm	Mattias Ekholm	D	1	8475218	14	\N	\N	\N	\N	\N	\N	\N	\N	\N
17	ty-emberson	Ty Emberson	D	1	8480834	49	\N	\N	\N	\N	\N	\N	\N	\N	\N
18	shakir-mukhamadullin	Shakir Mukhamadullin	D	1	8482166	85	\N	\N	\N	\N	\N	\N	\N	\N	\N
19	connor-murphy	Connor Murphy	D	1	8476473	5	\N	\N	\N	\N	\N	\N	\N	\N	\N
20	ryan-shea	Ryan Shea	D	1	8478854	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
21	jake-walman	Jake Walman	D	1	8478013	96	\N	\N	\N	\N	\N	\N	\N	\N	\N
22	frederik-andersen	Frederik Andersen	G	1	8475883	30	\N	\N	\N	\N	\N	\N	\N	\N	\N
23	tristan-jarry	Tristan Jarry	G	1	8477465	35	\N	\N	\N	\N	\N	\N	\N	\N	\N
24	devon-levi	Devon Levi	G	1	8482221	27	\N	\N	\N	\N	\N	\N	\N	\N	\N
1	connor-mcdavid	Connor McDavid	C	1	8478402	97	12.5	2030	3	\N	\N	\N	\N	\N	\N
27	kevin-fiala	Kevin Fiala	L	19	8477942	22	\N	\N	\N	\N	\N	\N	\N	\N	\N
28	erik-haula	Erik Haula	L	19	8475287	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
29	samuel-helenius	Samuel Helenius	C	19	8482726	79	\N	\N	\N	\N	\N	\N	\N	\N	\N
30	adrian-kempe	Adrian Kempe	R	19	8477960	9	\N	\N	\N	\N	\N	\N	\N	\N	\N
32	scott-laughton	Scott Laughton	C	19	8476872	21	\N	\N	\N	\N	\N	\N	\N	\N	\N
33	trevor-moore	Trevor Moore	L	19	8479675	12	\N	\N	\N	\N	\N	\N	\N	\N	\N
34	artemi-panarin	Artemi Panarin	L	19	8478550	10	\N	\N	\N	\N	\N	\N	\N	\N	\N
35	corey-perry	Corey Perry	R	19	8470621	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
36	alex-turcotte	Alex Turcotte	C	19	8481532	15	\N	\N	\N	\N	\N	\N	\N	\N	\N
55	hunter-haight	HUNTER HAIGHT	F	308	8483452	37	\N	\N	\N	\N	\N	\N	\N	\N	\N
38	mats-zuccarello	Mats Zuccarello	C	19	8475692	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
39	mikey-anderson	Mikey Anderson	D	19	8479998	44	\N	\N	\N	\N	\N	\N	\N	\N	\N
41	brandt-clarke	Brandt Clarke	D	19	8482730	92	\N	\N	\N	\N	\N	\N	\N	\N	\N
42	drew-doughty	Drew Doughty	D	19	8474563	8	\N	\N	\N	\N	\N	\N	\N	\N	\N
43	brian-dumoulin	Brian Dumoulin	D	19	8475208	2	\N	\N	\N	\N	\N	\N	\N	\N	\N
44	joel-edmundson	Joel Edmundson	D	19	8476441	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
70	carson-lambos	CARSON LAMBOS	D	308	8482781	28	\N	\N	\N	\N	\N	\N	\N	\N	\N
47	anton-forsberg	Anton Forsberg	G	19	8476341	31	\N	\N	\N	\N	\N	\N	\N	\N	\N
48	darcy-kuemper	Darcy Kuemper	G	19	8475311	35	\N	\N	\N	\N	\N	\N	\N	\N	\N
49	matt-boldy	Matt Boldy	L	20	8481557	12	\N	\N	\N	\N	\N	\N	\N	\N	\N
50	bobby-brink	Bobby Brink	R	20	8481553	10	\N	\N	\N	\N	\N	\N	\N	\N	\N
51	blake-coleman	Blake Coleman	L	20	8476399	20	\N	\N	\N	\N	\N	\N	\N	\N	\N
53	marcus-foligno	Marcus Foligno	L	20	8475220	17	\N	\N	\N	\N	\N	\N	\N	\N	\N
54	nick-foligno	Nick Foligno	L	20	8473422	71	\N	\N	\N	\N	\N	\N	\N	\N	\N
69	matt-kiersted	MATT KIERSTED	D	308	8482641	26	\N	\N	\N	\N	\N	\N	\N	\N	\N
56	ryan-hartman	Ryan Hartman	R	20	8477451	38	\N	\N	\N	\N	\N	\N	\N	\N	\N
57	kirill-kaprizov	Kirill Kaprizov	L	20	8478864	97	\N	\N	\N	\N	\N	\N	\N	\N	\N
58	michael-mccarron	Michael McCarron	C	20	8477446	47	\N	\N	\N	\N	\N	\N	\N	\N	\N
60	nico-sturm	Nico Sturm	C	20	8481477	78	\N	\N	\N	\N	\N	\N	\N	\N	\N
61	yakov-trenin	Yakov Trenin	C	20	8478508	13	\N	\N	\N	\N	\N	\N	\N	\N	\N
62	danila-yurov	Danila Yurov	R	20	8483525	22	\N	\N	\N	\N	\N	\N	\N	\N	\N
63	zach-bogosian	Zach Bogosian	D	20	8474567	24	\N	\N	\N	\N	\N	\N	\N	\N	\N
64	jonas-brodin	Jonas Brodin	D	20	8476463	25	\N	\N	\N	\N	\N	\N	\N	\N	\N
65	brock-faber	Brock Faber	D	20	8482122	7	\N	\N	\N	\N	\N	\N	\N	\N	\N
67	quinn-hughes	Quinn Hughes	D	20	8480800	43	\N	\N	\N	\N	\N	\N	\N	\N	\N
68	daemon-hunt	Daemon Hunt	D	20	8482094	48	\N	\N	\N	\N	\N	\N	\N	\N	\N
92	florian-xhekaj	FLORIAN XHEKAJ	C	309	8484403	63	\N	\N	\N	\N	\N	\N	\N	\N	\N
80	owen-beck	OWEN BECK	F	309	8483424	62	\N	\N	\N	\N	\N	\N	\N	\N	\N
71	olli-maatta	Olli Maatta	D	20	8476874	3	\N	\N	\N	\N	\N	\N	\N	\N	\N
8	max-jones	MAX JONES	L	296	8479368	46	\N	\N	\N	\N	\N	\N	\N	\N	\N
73	jared-spurgeon	Jared Spurgeon	D	20	8474716	46	\N	\N	\N	\N	\N	\N	\N	\N	\N
74	filip-gustavsson	Filip Gustavsson	G	20	8479406	32	\N	\N	\N	\N	\N	\N	\N	\N	\N
76	calvin-pickard	Calvin Pickard	G	20	8475717	31	\N	\N	\N	\N	\N	\N	\N	\N	\N
77	jesper-wallstedt	Jesper Wallstedt	G	20	8482661	30	\N	\N	\N	\N	\N	\N	\N	\N	\N
78	chase-wutzke	Chase Wutzke	G	20	8485037	95	\N	\N	\N	\N	\N	\N	\N	\N	\N
79	josh-anderson	Josh Anderson	R	21	8476981	17	\N	\N	\N	\N	\N	\N	\N	\N	\N
111	aiden-fink	AIDEN FINK	R	312	8484494	18	\N	\N	\N	\N	\N	\N	\N	\N	\N
81	zachary-bolduc	Zachary Bolduc	R	21	8482737	76	\N	\N	\N	\N	\N	\N	\N	\N	\N
83	kirby-dach	Kirby Dach	C	21	8481523	77	\N	\N	\N	\N	\N	\N	\N	\N	\N
84	phillip-danault	Phillip Danault	C	21	8476479	24	\N	\N	\N	\N	\N	\N	\N	\N	\N
85	ivan-demidov	Ivan Demidov	R	21	8484984	93	\N	\N	\N	\N	\N	\N	\N	\N	\N
86	jake-evans	Jake Evans	C	21	8478133	71	\N	\N	\N	\N	\N	\N	\N	\N	\N
87	oliver-kapanen	Oliver Kapanen	C	21	8482775	91	\N	\N	\N	\N	\N	\N	\N	\N	\N
89	juraj-slafkovsk	Juraj Slafkovský	L	21	8483515	20	\N	\N	\N	\N	\N	\N	\N	\N	\N
90	nick-suzuki	Nick Suzuki	C	21	8480018	14	\N	\N	\N	\N	\N	\N	\N	\N	\N
91	alexandre-texier	Alexandre Texier	L	21	8480074	85	\N	\N	\N	\N	\N	\N	\N	\N	\N
46	scott-perunovich	SCOTT PERUNOVICH	D	323	8481059	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
93	alexandre-carrier	Alexandre Carrier	D	21	8478851	45	\N	\N	\N	\N	\N	\N	\N	\N	\N
72	david-spacek	DAVID SPACEK	D	308	8483766	82	\N	\N	\N	\N	\N	\N	\N	\N	\N
96	kaiden-guhle	Kaiden Guhle	D	21	8482087	21	\N	\N	\N	\N	\N	\N	\N	\N	\N
97	lane-hutson	Lane Hutson	D	21	8483457	48	\N	\N	\N	\N	\N	\N	\N	\N	\N
98	mike-matheson	Mike Matheson	D	21	8476875	8	\N	\N	\N	\N	\N	\N	\N	\N	\N
100	jayden-struble	Jayden Struble	D	21	8481593	47	\N	\N	\N	\N	\N	\N	\N	\N	\N
102	arber-xhekaj	Arber Xhekaj	D	21	8482964	72	\N	\N	\N	\N	\N	\N	\N	\N	\N
103	jakub-dobes	Jakub Dobes	G	21	8482487	75	\N	\N	\N	\N	\N	\N	\N	\N	\N
104	jacob-fowler	Jacob Fowler	G	21	8484170	32	\N	\N	\N	\N	\N	\N	\N	\N	\N
105	samuel-montembeault	Samuel Montembeault	G	21	8478470	35	\N	\N	\N	\N	\N	\N	\N	\N	\N
106	mavrik-bourque	Mavrik Bourque	C	22	8482145	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
107	ross-colton	Ross Colton	C	22	8479525	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
108	jack-drury	Jack Drury	C	22	8480835	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
110	luke-evangelista	Luke Evangelista	R	22	8482146	77	\N	\N	\N	\N	\N	\N	\N	\N	\N
112	filip-forsberg	Filip Forsberg	L	22	8476887	9	\N	\N	\N	\N	\N	\N	\N	\N	\N
113	nils-hoglander	Nils Hoglander	L	22	8481535	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
115	jonathan-marchessault	Jonathan Marchessault	C	22	8476539	81	\N	\N	\N	\N	\N	\N	\N	\N	\N
116	ryan-oreilly	Ryan O'Reilly	C	22	8475158	90	\N	\N	\N	\N	\N	\N	\N	\N	\N
117	steven-stamkos	Steven Stamkos	C	22	8474564	91	\N	\N	\N	\N	\N	\N	\N	\N	\N
396	michael-carcone	Michael Carcone	L	34	8479619	53	\N	\N	\N	\N	\N	\N	\N	\N	\N
5	trent-frederic	Trent Frederic	C	1	8479365	10	\N	\N	\N	\N	\N	\N	\N	\N	\N
26	quinton-byfield	Quinton Byfield	R	19	8482124	55	\N	\N	\N	\N	\N	\N	\N	\N	\N
7	mattias-janmark	Mattias Janmark	C	1	8477406	13	\N	\N	\N	\N	\N	\N	\N	\N	\N
6	zach-hyman	Zach Hyman	L	1	8475786	18	\N	\N	\N	\N	\N	\N	\N	\N	\N
123	ilya-lyubushkin	Ilya Lyubushkin	D	22	8480950	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
124	nick-perbix	Nick Perbix	D	22	8480246	48	\N	\N	\N	\N	\N	\N	\N	\N	\N
125	brady-skjei	Brady Skjei	D	22	8476869	76	\N	\N	\N	\N	\N	\N	\N	\N	\N
126	adam-wilsby	Adam Wilsby	D	22	8482482	83	\N	\N	\N	\N	\N	\N	\N	\N	\N
128	juuse-saros	Juuse Saros	G	22	8477424	74	\N	\N	\N	\N	\N	\N	\N	\N	\N
129	nick-bjugstad	Nick Bjugstad	C	23	8475760	72	\N	\N	\N	\N	\N	\N	\N	\N	\N
130	jesper-boqvist	Jesper Boqvist	C	23	8480003	70	\N	\N	\N	\N	\N	\N	\N	\N	\N
131	jesper-bratt	Jesper Bratt	L	23	8479407	63	\N	\N	\N	\N	\N	\N	\N	\N	\N
132	connor-brown	Connor Brown	R	23	8477015	16	\N	\N	\N	\N	\N	\N	\N	\N	\N
133	cody-glass	Cody Glass	C	23	8479996	12	\N	\N	\N	\N	\N	\N	\N	\N	\N
135	nico-hischier	Nico Hischier	C	23	8480002	13	\N	\N	\N	\N	\N	\N	\N	\N	\N
209	stephen-halliday	STEPHEN HALLIDAY	C	297	8483676	83	\N	\N	\N	\N	\N	\N	\N	\N	\N
137	anthony-mantha	Anthony Mantha	R	23	8477511	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
138	timo-meier	Timo Meier	R	23	8478414	28	\N	\N	\N	\N	\N	\N	\N	\N	\N
139	dawson-mercer	Dawson Mercer	C	23	8482110	91	\N	\N	\N	\N	\N	\N	\N	\N	\N
141	evan-rodrigues	Evan Rodrigues	C	23	8478542	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
142	declan-chisholm	Declan Chisholm	D	23	8480990	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
143	brenden-dillon	Brenden Dillon	D	23	8475455	5	\N	\N	\N	\N	\N	\N	\N	\N	\N
144	dougie-hamilton	Dougie Hamilton	D	23	8476462	7	\N	\N	\N	\N	\N	\N	\N	\N	\N
145	luke-hughes	Luke Hughes	D	23	8482684	43	\N	\N	\N	\N	\N	\N	\N	\N	\N
147	brett-pesce	Brett Pesce	D	23	8477488	22	\N	\N	\N	\N	\N	\N	\N	\N	\N
148	jonas-siegenthaler	Jonas Siegenthaler	D	23	8478399	71	\N	\N	\N	\N	\N	\N	\N	\N	\N
149	jake-allen	Jake Allen	G	23	8474596	34	\N	\N	\N	\N	\N	\N	\N	\N	\N
150	david-rittich	David Rittich	G	23	8479496	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
151	mathew-barzal	Mathew Barzal	C	24	8478445	13	\N	\N	\N	\N	\N	\N	\N	\N	\N
152	casey-cizikas	Casey Cizikas	C	24	8475231	53	\N	\N	\N	\N	\N	\N	\N	\N	\N
153	anthony-duclair	Anthony Duclair	L	24	8477407	11	\N	\N	\N	\N	\N	\N	\N	\N	\N
154	emil-heineman	Emil Heineman	L	24	8482476	51	\N	\N	\N	\N	\N	\N	\N	\N	\N
156	bo-horvat	Bo Horvat	C	24	8477500	14	\N	\N	\N	\N	\N	\N	\N	\N	\N
157	matias-maccelli	Matias Maccelli	L	24	8481711	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
158	kyle-maclean	Kyle MacLean	C	24	8481237	32	\N	\N	\N	\N	\N	\N	\N	\N	\N
159	jean-gabriel-pageau	Jean-Gabriel Pageau	C	24	8476419	44	\N	\N	\N	\N	\N	\N	\N	\N	\N
160	ondrej-palat	Ondrej Palat	L	24	8476292	81	\N	\N	\N	\N	\N	\N	\N	\N	\N
161	kyle-palmieri	Kyle Palmieri	C	24	8475151	21	\N	\N	\N	\N	\N	\N	\N	\N	\N
162	brayden-schenn	Brayden Schenn	C	24	8475170	10	\N	\N	\N	\N	\N	\N	\N	\N	\N
164	matthew-kessel	Matthew Kessel	D	24	8482516	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
165	scott-mayfield	Scott Mayfield	D	24	8476429	24	\N	\N	\N	\N	\N	\N	\N	\N	\N
166	adam-pelech	Adam Pelech	D	24	8476917	3	\N	\N	\N	\N	\N	\N	\N	\N	\N
167	ryan-pulock	Ryan Pulock	D	24	8477506	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
169	matthew-schaefer	Matthew Schaefer	D	24	8485366	48	\N	\N	\N	\N	\N	\N	\N	\N	\N
170	ilya-sorokin	Ilya Sorokin	G	24	8478009	30	\N	\N	\N	\N	\N	\N	\N	\N	\N
171	vitek-vanecek	Vitek Vanecek	G	24	8477970	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
172	semyon-varlamov	Semyon Varlamov	G	24	8473575	40	\N	\N	\N	\N	\N	\N	\N	\N	\N
173	oliver-bjorkstrand	Oliver Bjorkstrand	R	25	8477416	28	\N	\N	\N	\N	\N	\N	\N	\N	\N
234	jacob-gaucher	JACOB GAUCHER	F	310	8481848	78	\N	\N	\N	\N	\N	\N	\N	\N	\N
175	will-cuylle	Will Cuylle	L	25	8482157	50	\N	\N	\N	\N	\N	\N	\N	\N	\N
177	tye-kartye	Tye Kartye	L	25	8481789	24	\N	\N	\N	\N	\N	\N	\N	\N	\N
178	noah-laba	Noah Laba	C	25	8483690	42	\N	\N	\N	\N	\N	\N	\N	\N	\N
179	alexis-lafrenire	Alexis Lafrenière	L	25	8482109	13	\N	\N	\N	\N	\N	\N	\N	\N	\N
180	jt-miller	J.T. Miller	C	25	8476468	10	\N	\N	\N	\N	\N	\N	\N	\N	\N
201	tyler-boucher	TYLER BOUCHER	R	297	8482674	54	\N	\N	\N	\N	\N	\N	\N	\N	\N
182	taylor-raddysh	Taylor Raddysh	R	25	8479390	14	\N	\N	\N	\N	\N	\N	\N	\N	\N
183	matt-rempe	Matt Rempe	C	25	8482460	73	\N	\N	\N	\N	\N	\N	\N	\N	\N
185	joe-veleno	Joe Veleno	C	25	8480813	90	\N	\N	\N	\N	\N	\N	\N	\N	\N
186	mika-zibanejad	Mika Zibanejad	C	25	8476459	93	\N	\N	\N	\N	\N	\N	\N	\N	\N
187	sean-durzi	Sean Durzi	D	25	8480434	5	\N	\N	\N	\N	\N	\N	\N	\N	\N
188	drew-fortescue	Drew Fortescue	D	25	8484169	45	\N	\N	\N	\N	\N	\N	\N	\N	\N
189	adam-fox	Adam Fox	D	25	8479323	23	\N	\N	\N	\N	\N	\N	\N	\N	\N
212	oskar-pettersson	OSKAR PETTERSSON	R	297	8483673	63	\N	\N	\N	\N	\N	\N	\N	\N	\N
192	marcus-pettersson	Marcus Pettersson	D	25	8477969	26	\N	\N	\N	\N	\N	\N	\N	\N	\N
193	matthew-robertson	Matthew Robertson	D	25	8481525	29	\N	\N	\N	\N	\N	\N	\N	\N	\N
194	braden-schneider	Braden Schneider	D	25	8482073	4	\N	\N	\N	\N	\N	\N	\N	\N	\N
195	urho-vaakanainen	Urho Vaakanainen	D	25	8480001	18	\N	\N	\N	\N	\N	\N	\N	\N	\N
197	joonas-korpisalo	Joonas Korpisalo	G	25	8476914	70	\N	\N	\N	\N	\N	\N	\N	\N	\N
198	igor-shesterkin	Igor Shesterkin	G	25	8478048	31	\N	\N	\N	\N	\N	\N	\N	\N	\N
200	drake-batherson	Drake Batherson	R	26	8480208	19	\N	\N	\N	\N	\N	\N	\N	\N	\N
229	alex-bump	ALEX BUMP	F	310	8483731	20	\N	\N	\N	\N	\N	\N	\N	\N	\N
202	andre-burakovsky	Andre Burakovsky	L	26	8477444	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
203	nick-cousins	Nick Cousins	C	26	8476393	21	\N	\N	\N	\N	\N	\N	\N	\N	\N
205	william-eklund	William Eklund	L	26	8482667	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
206	warren-foegele	Warren Foegele	L	26	8477998	37	\N	\N	\N	\N	\N	\N	\N	\N	\N
207	claude-giroux	Claude Giroux	R	26	8473512	28	\N	\N	\N	\N	\N	\N	\N	\N	\N
208	ridly-greig	Ridly Greig	C	26	8482092	71	\N	\N	\N	\N	\N	\N	\N	\N	\N
119	matthew-wood	MATTHEW WOOD	L	312	8484241	71	\N	\N	\N	\N	\N	\N	\N	\N	\N
211	kurtis-macdermid	Kurtis MacDermid	L	26	8477073	23	\N	\N	\N	\N	\N	\N	\N	\N	\N
136	jack-hughes	JACK HUGHES	F	313	8481559	86	\N	\N	\N	\N	\N	\N	\N	\N	\N
213	shane-pinto	Shane Pinto	C	26	8481596	12	\N	\N	\N	\N	\N	\N	\N	\N	\N
214	tim-sttzle	Tim Stützle	C	26	8482116	18	\N	\N	\N	\N	\N	\N	\N	\N	\N
215	fabian-zetterlund	Fabian Zetterlund	L	26	8480188	20	\N	\N	\N	\N	\N	\N	\N	\N	\N
216	thomas-chabot	Thomas Chabot	D	26	8478469	72	\N	\N	\N	\N	\N	\N	\N	\N	\N
218	tyler-kleven	Tyler Kleven	D	26	8482095	43	\N	\N	\N	\N	\N	\N	\N	\N	\N
219	nikolas-matinpalo	Nikolas Matinpalo	D	26	8484321	33	\N	\N	\N	\N	\N	\N	\N	\N	\N
220	jake-sanderson	Jake Sanderson	D	26	8482105	85	\N	\N	\N	\N	\N	\N	\N	\N	\N
221	jordan-spence	Jordan Spence	D	26	8481606	10	\N	\N	\N	\N	\N	\N	\N	\N	\N
223	artem-zub	Artem Zub	D	26	8482245	2	\N	\N	\N	\N	\N	\N	\N	\N	\N
224	samuel-ersson	Samuel Ersson	G	26	8481035	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
225	leevi-merilinen	Leevi Meriläinen	G	26	8482447	1	\N	\N	\N	\N	\N	\N	\N	\N	\N
226	linus-ullmark	Linus Ullmark	G	26	8476999	35	\N	\N	\N	\N	\N	\N	\N	\N	\N
227	noel-acciari	Noel Acciari	C	27	8478569	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
181	gabe-perreault	GABE PERREAULT	F	305	8484210	94	\N	\N	\N	\N	\N	\N	\N	\N	\N
230	noah-cates	Noah Cates	L	27	8480220	27	\N	\N	\N	\N	\N	\N	\N	\N	\N
232	christian-dvorak	Christian Dvorak	C	27	8477989	22	\N	\N	\N	\N	\N	\N	\N	\N	\N
233	tyson-foerster	Tyson Foerster	R	27	8482159	71	\N	\N	\N	\N	\N	\N	\N	\N	\N
191	vincent-iorio	VINCENT IORIO	D	318	8482861	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
422	brock-boeser	Brock Boeser	R	35	8478444	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
228	denver-barkey	DENVER BARKEY	F	310	8484142	52	\N	\N	\N	\N	\N	\N	\N	\N	\N
122	roman-josi	Roman Josi	D	22	8474600	59	\N	\N	\N	\N	\N	\N	\N	\N	\N
121	nicolas-hague	Nicolas Hague	D	22	8479980	41	\N	\N	\N	\N	\N	\N	\N	\N	\N
240	matvei-michkov	Matvei Michkov	R	27	8484387	39	\N	\N	\N	\N	\N	\N	\N	\N	\N
242	trevor-zegras	Trevor Zegras	C	27	8481533	46	\N	\N	\N	\N	\N	\N	\N	\N	\N
243	simon-benoit	Simon Benoit	D	27	8481122	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9874	matt-luff	MATT LUFF	R	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
245	jamie-drysdale	Jamie Drysdale	D	27	8482142	9	\N	\N	\N	\N	\N	\N	\N	\N	\N
247	david-jiricek	DAVID JIRICEK	D	310	8483460	5	\N	\N	\N	\N	\N	\N	\N	\N	\N
249	rasmus-ristolainen	Rasmus Ristolainen	D	27	8477499	55	\N	\N	\N	\N	\N	\N	\N	\N	\N
250	travis-sanheim	Travis Sanheim	D	27	8477948	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
251	nick-seeler	Nick Seeler	D	27	8476372	24	\N	\N	\N	\N	\N	\N	\N	\N	\N
252	cam-york	Cam York	D	27	8481546	8	\N	\N	\N	\N	\N	\N	\N	\N	\N
253	carson-bjarnason	Carson Bjarnason	G	27	8484147	64	\N	\N	\N	\N	\N	\N	\N	\N	\N
255	dan-vladar	Dan Vladar	G	27	8478435	80	\N	\N	\N	\N	\N	\N	\N	\N	\N
256	joseph-woll	Joseph Woll	G	27	8479361	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
257	justin-brazeau	Justin Brazeau	R	28	8479638	16	\N	\N	\N	\N	\N	\N	\N	\N	\N
258	egor-chinakhov	Egor Chinakhov	R	28	8482475	59	\N	\N	\N	\N	\N	\N	\N	\N	\N
259	sidney-crosby	Sidney Crosby	C	28	8471675	87	\N	\N	\N	\N	\N	\N	\N	\N	\N
260	connor-dewar	Connor Dewar	C	28	8480980	19	\N	\N	\N	\N	\N	\N	\N	\N	\N
261	ben-kindel	Ben Kindel	C	28	8485414	81	\N	\N	\N	\N	\N	\N	\N	\N	\N
262	andrei-kuzmenko	Andrei Kuzmenko	L	28	8483808	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
264	blake-lizotte	Blake Lizotte	C	28	8481481	46	\N	\N	\N	\N	\N	\N	\N	\N	\N
265	evgeni-malkin	Evgeni Malkin	C	28	8471215	71	\N	\N	\N	\N	\N	\N	\N	\N	\N
266	tommy-novak	Tommy Novak	C	28	8478438	18	\N	\N	\N	\N	\N	\N	\N	\N	\N
267	rickard-rakell	Rickard Rakell	R	28	8476483	67	\N	\N	\N	\N	\N	\N	\N	\N	\N
268	nicholas-robertson	Nicholas Robertson	L	28	8481582	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
269	bryan-rust	Bryan Rust	R	28	8475810	17	\N	\N	\N	\N	\N	\N	\N	\N	\N
246	helge-grans	HELGE GRANS	D	310	8482169	3	\N	\N	\N	\N	\N	\N	\N	\N	\N
272	samuel-girard	Samuel Girard	D	28	8479398	49	\N	\N	\N	\N	\N	\N	\N	\N	\N
286	michael-misa	MICHAEL MISA	F	318	8485402	77	\N	\N	\N	\N	\N	\N	\N	\N	\N
274	erik-karlsson	Erik Karlsson	D	28	8474578	65	\N	\N	\N	\N	\N	\N	\N	\N	\N
275	kaedan-korczak	Kaedan Korczak	D	28	8481527	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
276	kris-letang	Kris Letang	D	28	8471724	58	\N	\N	\N	\N	\N	\N	\N	\N	\N
278	sergei-murashov	Sergei Murashov	G	28	8483703	1	\N	\N	\N	\N	\N	\N	\N	\N	\N
279	arturs-silovs	Arturs Silovs	G	28	8481668	37	\N	\N	\N	\N	\N	\N	\N	\N	\N
280	macklin-celebrini	Macklin Celebrini	C	29	8484801	71	\N	\N	\N	\N	\N	\N	\N	\N	\N
281	ty-dellandrea	Ty Dellandrea	C	29	8480848	10	\N	\N	\N	\N	\N	\N	\N	\N	\N
282	adam-gaudette	Adam Gaudette	R	29	8478874	81	\N	\N	\N	\N	\N	\N	\N	\N	\N
283	barclay-goodrow	Barclay Goodrow	C	29	8476624	23	\N	\N	\N	\N	\N	\N	\N	\N	\N
284	collin-graf	Collin Graf	R	29	8484911	51	\N	\N	\N	\N	\N	\N	\N	\N	\N
287	zack-ostapchuk	ZACK OSTAPCHUK	C	318	8482859	63	\N	\N	\N	\N	\N	\N	\N	\N	\N
271	declan-carlile	DECLAN CARLILE	D	320	8483398	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
288	kiefer-sherwood	Kiefer Sherwood	L	29	8480748	44	\N	\N	\N	\N	\N	\N	\N	\N	\N
289	will-smith	Will Smith	C	29	8484227	2	\N	\N	\N	\N	\N	\N	\N	\N	\N
290	tyler-toffoli	Tyler Toffoli	C	29	8475726	73	\N	\N	\N	\N	\N	\N	\N	\N	\N
292	sam-dickinson	Sam Dickinson	D	29	8484806	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
293	michael-kesselring	Michael Kesselring	D	29	8480891	7	\N	\N	\N	\N	\N	\N	\N	\N	\N
294	darnell-nurse	Darnell Nurse	D	29	8477498	25	\N	\N	\N	\N	\N	\N	\N	\N	\N
295	dmitry-orlov	Dmitry Orlov	D	29	8475200	9	\N	\N	\N	\N	\N	\N	\N	\N	\N
296	jacob-trouba	Jacob Trouba	D	29	8476885	65	\N	\N	\N	\N	\N	\N	\N	\N	\N
297	yaroslav-askarov	Yaroslav Askarov	G	29	8482137	30	\N	\N	\N	\N	\N	\N	\N	\N	\N
298	eric-comrie	Eric Comrie	G	29	8477480	1	\N	\N	\N	\N	\N	\N	\N	\N	\N
300	matty-beniers	Matty Beniers	C	30	8482665	10	\N	\N	\N	\N	\N	\N	\N	\N	\N
301	berkly-catton	Berkly Catton	C	30	8484800	27	\N	\N	\N	\N	\N	\N	\N	\N	\N
302	jordan-eberle	Jordan Eberle	R	30	8474586	7	\N	\N	\N	\N	\N	\N	\N	\N	\N
303	frederick-gaudreau	Frederick Gaudreau	C	30	8477919	89	\N	\N	\N	\N	\N	\N	\N	\N	\N
304	kaapo-kakko	Kaapo Kakko	R	30	8481554	84	\N	\N	\N	\N	\N	\N	\N	\N	\N
305	jared-mccann	Jared McCann	L	30	8477955	19	\N	\N	\N	\N	\N	\N	\N	\N	\N
307	ben-meyers	BEN MEYERS	F	302	8483570	59	\N	\N	\N	\N	\N	\N	\N	\N	\N
308	mackie-samoskevich	Mackie Samoskevich	R	30	8482713	11	\N	\N	\N	\N	\N	\N	\N	\N	\N
309	chandler-stephenson	Chandler Stephenson	C	30	8476905	9	\N	\N	\N	\N	\N	\N	\N	\N	\N
310	ryan-winterton	Ryan Winterton	C	30	8482751	26	\N	\N	\N	\N	\N	\N	\N	\N	\N
311	shane-wright	Shane Wright	C	30	8483524	51	\N	\N	\N	\N	\N	\N	\N	\N	\N
312	vince-dunn	Vince Dunn	D	30	8478407	29	\N	\N	\N	\N	\N	\N	\N	\N	\N
314	cale-fleury	Cale Fleury	D	30	8479985	8	\N	\N	\N	\N	\N	\N	\N	\N	\N
315	adam-larsson	Adam Larsson	D	30	8476457	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
316	ryan-lindgren	Ryan Lindgren	D	30	8479324	55	\N	\N	\N	\N	\N	\N	\N	\N	\N
317	joshua-mahura	Joshua Mahura	D	30	8479372	28	\N	\N	\N	\N	\N	\N	\N	\N	\N
319	joey-daccord	Joey Daccord	G	30	8478916	35	\N	\N	\N	\N	\N	\N	\N	\N	\N
320	philipp-grubauer	Philipp Grubauer	G	30	8475831	31	\N	\N	\N	\N	\N	\N	\N	\N	\N
321	jonatan-berggren	Jonatan Berggren	R	31	8481013	29	\N	\N	\N	\N	\N	\N	\N	\N	\N
322	pavel-buchnevich	Pavel Buchnevich	L	31	8477402	89	\N	\N	\N	\N	\N	\N	\N	\N	\N
273	ryan-graves	RYAN GRAVES	D	325	8477435	27	\N	\N	\N	\N	\N	\N	\N	\N	\N
324	jack-finley	JACK FINLEY	C	320	8482090	37	\N	\N	\N	\N	\N	\N	\N	\N	\N
325	dylan-holloway	Dylan Holloway	L	31	8482077	81	\N	\N	\N	\N	\N	\N	\N	\N	\N
327	connor-mcmichael	Connor McMichael	L	31	8481580	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
328	mason-mctavish	Mason McTavish	C	31	8482745	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
329	jake-neighbours	Jake Neighbours	L	31	8482089	63	\N	\N	\N	\N	\N	\N	\N	\N	\N
330	jimmy-snuggerud	Jimmy Snuggerud	R	31	8483516	21	\N	\N	\N	\N	\N	\N	\N	\N	\N
331	oskar-sundqvist	Oskar Sundqvist	C	31	8476897	70	\N	\N	\N	\N	\N	\N	\N	\N	\N
332	pius-suter	Pius Suter	C	31	8480459	22	\N	\N	\N	\N	\N	\N	\N	\N	\N
334	alexey-toropchenko	Alexey Toropchenko	R	31	8480281	13	\N	\N	\N	\N	\N	\N	\N	\N	\N
335	nathan-walker	Nathan Walker	L	31	8477573	26	\N	\N	\N	\N	\N	\N	\N	\N	\N
336	philip-broberg	Philip Broberg	D	31	8481598	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
337	brandon-carlo	Brandon Carlo	D	31	8478443	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
338	cam-fowler	Cam Fowler	D	31	8475764	17	\N	\N	\N	\N	\N	\N	\N	\N	\N
340	colton-parayko	Colton Parayko	D	31	8476892	55	\N	\N	\N	\N	\N	\N	\N	\N	\N
341	tyler-tucker	Tyler Tucker	D	31	8481006	75	\N	\N	\N	\N	\N	\N	\N	\N	\N
342	jordan-binnington	Jordan Binnington	G	31	8476412	50	\N	\N	\N	\N	\N	\N	\N	\N	\N
343	joel-hofer	Joel Hofer	G	31	8480981	30	\N	\N	\N	\N	\N	\N	\N	\N	\N
344	anthony-cirelli	Anthony Cirelli	C	32	8478519	71	\N	\N	\N	\N	\N	\N	\N	\N	\N
346	zemgus-girgensons	Zemgus Girgensons	C	32	8476878	28	\N	\N	\N	\N	\N	\N	\N	\N	\N
347	gage-goncalves	Gage Goncalves	C	32	8482201	93	\N	\N	\N	\N	\N	\N	\N	\N	\N
348	yanni-gourde	Yanni Gourde	C	32	8476826	37	\N	\N	\N	\N	\N	\N	\N	\N	\N
349	jake-guentzel	Jake Guentzel	C	32	8477404	59	\N	\N	\N	\N	\N	\N	\N	\N	\N
350	brandon-hagel	Brandon Hagel	L	32	8479542	38	\N	\N	\N	\N	\N	\N	\N	\N	\N
237	travis-konecny	Travis Konecny	R	27	8478439	11	\N	\N	\N	\N	\N	\N	\N	\N	\N
238	jett-luchanko	Jett Luchanko	C	27	8484779	17	\N	\N	\N	\N	\N	\N	\N	\N	\N
239	porter-martone	Porter Martone	R	27	8485406	94	\N	\N	\N	\N	\N	\N	\N	\N	\N
244	oliver-bonk	OLIVER BONK	D	310	8484148	59	\N	\N	\N	\N	\N	\N	\N	\N	\N
399	dylan-guenther	Dylan Guenther	R	34	8482699	11	\N	\N	\N	\N	\N	\N	\N	\N	\N
400	barrett-hayton	Barrett Hayton	C	34	8480849	27	\N	\N	\N	\N	\N	\N	\N	\N	\N
401	cam-hebig	Cam Hebig	C	34	8479656	78	\N	\N	\N	\N	\N	\N	\N	\N	\N
403	anders-lee	Anders Lee	C	34	8475314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
404	jack-mcbain	Jack McBain	C	34	8480855	22	\N	\N	\N	\N	\N	\N	\N	\N	\N
413	maveric-lamoureux	MAVERIC LAMOUREUX	D	323	8483472	10	\N	\N	\N	\N	\N	\N	\N	\N	\N
406	liam-obrien	Liam O'Brien	C	34	8477070	38	\N	\N	\N	\N	\N	\N	\N	\N	\N
407	nick-schmaltz	Nick Schmaltz	C	34	8477951	8	\N	\N	\N	\N	\N	\N	\N	\N	\N
409	brandon-tanev	Brandon Tanev	L	34	8479293	13	\N	\N	\N	\N	\N	\N	\N	\N	\N
410	vincent-trocheck	Vincent Trocheck	C	34	8476389	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
411	kailer-yamamoto	Kailer Yamamoto	R	34	8479977	56	\N	\N	\N	\N	\N	\N	\N	\N	\N
412	nick-desimone	Nick DeSimone	D	34	8480084	57	\N	\N	\N	\N	\N	\N	\N	\N	\N
414	john-marino	John Marino	D	34	8478507	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
415	andrew-peeke	Andrew Peeke	D	34	8479369	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
417	mikhail-sergachev	Mikhail Sergachev	D	34	8479410	98	\N	\N	\N	\N	\N	\N	\N	\N	\N
433	max-sasson	MAX SASSON	C	295	8484136	63	\N	\N	\N	\N	\N	\N	\N	\N	\N
419	mackenzie-weegar	MacKenzie Weegar	D	34	8477346	52	\N	\N	\N	\N	\N	\N	\N	\N	\N
420	jaxson-stauber	Jaxson Stauber	G	34	8483530	33	\N	\N	\N	\N	\N	\N	\N	\N	\N
421	karel-vejmelka	Karel Vejmelka	G	34	8478872	70	\N	\N	\N	\N	\N	\N	\N	\N	\N
423	filip-chytil	Filip Chytil	C	35	8480078	72	\N	\N	\N	\N	\N	\N	\N	\N	\N
424	paul-cotter	Paul Cotter	C	35	8481032	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
425	jake-debrusk	Jake DeBrusk	L	35	8478498	74	\N	\N	\N	\N	\N	\N	\N	\N	\N
426	brendan-gallagher	Brendan Gallagher	R	35	8475848	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
427	linus-karlsson	Linus Karlsson	C	35	8481024	94	\N	\N	\N	\N	\N	\N	\N	\N	\N
428	drew-oconnor	Drew O'Connor	L	35	8482055	18	\N	\N	\N	\N	\N	\N	\N	\N	\N
434	zeev-buium	Zeev Buium	D	35	8484798	24	\N	\N	\N	\N	\N	\N	\N	\N	\N
435	filip-hronek	Filip Hronek	D	35	8479425	17	\N	\N	\N	\N	\N	\N	\N	\N	\N
437	jamie-oleksiak	Jamie Oleksiak	D	35	8476467	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
442	kevin-lankinen	Kevin Lankinen	G	35	8480947	32	\N	\N	\N	\N	\N	\N	\N	\N	\N
444	ivan-barbashev	Ivan Barbashev	L	36	8477964	49	\N	\N	\N	\N	\N	\N	\N	\N	\N
430	elias-pettersson	ELIAS PETTERSSON	D	295	8483678	25	\N	\N	\N	\N	\N	\N	\N	\N	\N
449	marc-gatcomb	MARC GATCOMB	F	326	8483553	17	\N	\N	\N	\N	\N	\N	\N	\N	\N
447	nic-dowd	Nic Dowd	C	36	8475343	26	\N	\N	\N	\N	\N	\N	\N	\N	\N
448	jack-eichel	Jack Eichel	C	36	8478403	9	\N	\N	\N	\N	\N	\N	\N	\N	\N
385	emil-andrae	EMIL ANDRAE	D	310	8482126	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
455	raphael-lavoie	RAPHAEL LAVOIE	F	306	8481534	36	\N	\N	\N	\N	\N	\N	\N	\N	\N
452	brett-howden	Brett Howden	C	36	8479353	21	\N	\N	\N	\N	\N	\N	\N	\N	\N
453	william-karlsson	William Karlsson	C	36	8476448	71	\N	\N	\N	\N	\N	\N	\N	\N	\N
374	luke-haymes	LUKE HAYMES	C	322	8485467	43	\N	\N	\N	\N	\N	\N	\N	\N	\N
445	braeden-bowman	BRAEDEN BOWMAN	F	306	8483890	42	\N	\N	\N	\N	\N	\N	\N	\N	\N
457	victor-olofsson	Victor Olofsson	R	36	8478109	95	\N	\N	\N	\N	\N	\N	\N	\N	\N
458	jonas-rondbjerg	Jonas Rondbjerg	R	36	8480007	46	\N	\N	\N	\N	\N	\N	\N	\N	\N
459	mark-stone	Mark Stone	R	36	8475913	61	\N	\N	\N	\N	\N	\N	\N	\N	\N
451	alexander-holtz	ALEXANDER HOLTZ	F	306	8482125	10	\N	\N	\N	\N	\N	\N	\N	\N	\N
461	rasmus-andersson	Rasmus Andersson	D	36	8478397	4	\N	\N	\N	\N	\N	\N	\N	\N	\N
357	scott-sabourin	SCOTT SABOURIN	R	320	8477149	46	\N	\N	\N	\N	\N	\N	\N	\N	\N
464	noah-hanifin	Noah Hanifin	D	36	8478396	15	\N	\N	\N	\N	\N	\N	\N	\N	\N
405	ben-mccartney	BEN MCCARTNEY	F	323	8481827	62	\N	\N	\N	\N	\N	\N	\N	\N	\N
466	jeremy-lauzon	Jeremy Lauzon	D	36	8478468	5	\N	\N	\N	\N	\N	\N	\N	\N	\N
467	brayden-mcnabb	Brayden McNabb	D	36	8475188	3	\N	\N	\N	\N	\N	\N	\N	\N	\N
418	dmitri-simashev	DMITRI SIMASHEV	D	323	8484386	26	\N	\N	\N	\N	\N	\N	\N	\N	\N
351	jansen-harkins	Jansen Harkins	C	32	8478424	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
352	pontus-holmberg	Pontus Holmberg	R	32	8480995	29	\N	\N	\N	\N	\N	\N	\N	\N	\N
354	nikita-kucherov	Nikita Kucherov	R	32	8476453	86	\N	\N	\N	\N	\N	\N	\N	\N	\N
355	ilya-mikheyev	Ilya Mikheyev	R	32	8481624	95	\N	\N	\N	\N	\N	\N	\N	\N	\N
460	kai-uchacz	KAI UCHACZ	F	306	8485251	77	\N	\N	\N	\N	\N	\N	\N	\N	\N
358	jeffrey-viel	Jeffrey Viel	L	32	8479705	25	\N	\N	\N	\N	\N	\N	\N	\N	\N
359	john-carlson	John Carlson	D	32	8474590	74	\N	\N	\N	\N	\N	\N	\N	\N	\N
360	erik-cernak	Erik Cernak	D	32	8478416	81	\N	\N	\N	\N	\N	\N	\N	\N	\N
361	max-crozier	Max Crozier	D	32	8481719	24	\N	\N	\N	\N	\N	\N	\N	\N	\N
363	victor-hedman	Victor Hedman	D	32	8475167	77	\N	\N	\N	\N	\N	\N	\N	\N	\N
364	emil-lilleberg	Emil Lilleberg	D	32	8482929	78	\N	\N	\N	\N	\N	\N	\N	\N	\N
365	ryan-mcdonagh	Ryan McDonagh	D	32	8474151	27	\N	\N	\N	\N	\N	\N	\N	\N	\N
366	jj-moser	J.J. Moser	D	32	8482655	90	\N	\N	\N	\N	\N	\N	\N	\N	\N
367	dennis-hildeby	Dennis Hildeby	G	32	8483710	35	\N	\N	\N	\N	\N	\N	\N	\N	\N
368	jonas-johansson	Jonas Johansson	G	32	8477992	31	\N	\N	\N	\N	\N	\N	\N	\N	\N
369	andrei-vasilevskiy	Andrei Vasilevskiy	G	32	8476883	88	\N	\N	\N	\N	\N	\N	\N	\N	\N
370	teddy-blueger	Teddy Blueger	C	2	8476927	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
371	max-domi	Max Domi	C	2	8477503	11	\N	\N	\N	\N	\N	\N	\N	\N	\N
373	bo-groulx	Bo Groulx	C	2	8480870	29	\N	\N	\N	\N	\N	\N	\N	\N	\N
440	tom-willander	TOM WILLANDER	D	295	8484240	5	\N	\N	\N	\N	\N	\N	\N	\N	\N
375	dakota-joshua	Dakota Joshua	C	2	8478057	81	\N	\N	\N	\N	\N	\N	\N	\N	\N
376	matthew-knies	Matthew Knies	L	2	8482720	23	\N	\N	\N	\N	\N	\N	\N	\N	\N
377	steven-lorentz	Steven Lorentz	C	2	8478904	18	\N	\N	\N	\N	\N	\N	\N	\N	\N
378	zack-macewen	Zack MacEwen	C	2	8479772	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
380	william-nylander	William Nylander	R	2	8477939	88	\N	\N	\N	\N	\N	\N	\N	\N	\N
381	nick-paul	Nick Paul	L	2	8477426	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
382	jack-roslovic	Jack Roslovic	C	2	8478458	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
383	colton-sissons	Colton Sissons	C	2	8476925	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
384	john-tavares	John Tavares	C	2	8475166	91	\N	\N	\N	\N	\N	\N	\N	\N	\N
446	trevor-connelly	TREVOR CONNELLY	F	306	8484803	24	\N	\N	\N	\N	\N	\N	\N	\N	\N
387	jake-mccabe	Jake McCabe	D	2	8476931	22	\N	\N	\N	\N	\N	\N	\N	\N	\N
388	philippe-myers	Philippe Myers	D	2	8479026	51	\N	\N	\N	\N	\N	\N	\N	\N	\N
389	darren-raddysh	Darren Raddysh	D	2	8478178	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
390	morgan-rielly	Morgan Rielly	D	2	8476853	44	\N	\N	\N	\N	\N	\N	\N	\N	\N
391	troy-stecher	Troy Stecher	D	2	8479442	28	\N	\N	\N	\N	\N	\N	\N	\N	\N
392	chris-tanev	Chris Tanev	D	2	8475690	8	\N	\N	\N	\N	\N	\N	\N	\N	\N
393	sergei-bobrovsky	Sergei Bobrovsky	G	2	8475683	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
353	dominic-james	DOMINIC JAMES	C	320	8483752	17	\N	\N	\N	\N	\N	\N	\N	\N	\N
397	logan-cooley	Logan Cooley	C	34	8483431	92	\N	\N	\N	\N	\N	\N	\N	\N	\N
398	lawson-crouse	Lawson Crouse	L	34	8478474	67	\N	\N	\N	\N	\N	\N	\N	\N	\N
463	jeremy-davies	JEREMY DAVIES	D	306	8479602	84	\N	\N	\N	\N	\N	\N	\N	\N	\N
395	daniil-but	DANIIL BUT	F	323	8484388	19	\N	\N	\N	\N	\N	\N	\N	\N	\N
441	thatcher-demko	Thatcher Demko	G	35	8477967	35	\N	\N	\N	\N	\N	\N	\N	\N	\N
432	marco-rossi	Marco Rossi	C	35	8482079	93	\N	\N	\N	\N	\N	\N	\N	\N	\N
431	aatu-rty	Aatu Räty	C	35	8482691	54	\N	\N	\N	\N	\N	\N	\N	\N	\N
439	luke-schenn	Luke Schenn	D	35	8474568	2	\N	\N	\N	\N	\N	\N	\N	\N	\N
471	carter-hart	Carter Hart	G	36	8479394	79	\N	\N	\N	\N	\N	\N	\N	\N	\N
472	adin-hill	Adin Hill	G	36	8478499	33	\N	\N	\N	\N	\N	\N	\N	\N	\N
474	anthony-beauvillier	Anthony Beauvillier	R	37	8478463	72	\N	\N	\N	\N	\N	\N	\N	\N	\N
475	pierre-luc-dubois	Pierre-Luc Dubois	C	37	8479400	80	\N	\N	\N	\N	\N	\N	\N	\N	\N
521	judd-caulfield	JUDD CAULFIELD	R	317	8481538	75	\N	\N	\N	\N	\N	\N	\N	\N	\N
477	boone-jenner	Boone Jenner	C	37	8476432	22	\N	\N	\N	\N	\N	\N	\N	\N	\N
478	jordan-kyrou	Jordan Kyrou	R	37	8479385	25	\N	\N	\N	\N	\N	\N	\N	\N	\N
545	noah-warren	NOAH WARREN	D	317	8483521	47	\N	\N	\N	\N	\N	\N	\N	\N	\N
481	alex-ovechkin	Alex Ovechkin	L	37	8471214	8	\N	\N	\N	\N	\N	\N	\N	\N	\N
482	aliaksei-protas	Aliaksei Protas	L	37	8481656	21	\N	\N	\N	\N	\N	\N	\N	\N	\N
522	nathan-gaucher	NATHAN GAUCHER	C	317	8483444	41	\N	\N	\N	\N	\N	\N	\N	\N	\N
484	justin-sourdif	Justin Sourdif	C	37	8482088	34	\N	\N	\N	\N	\N	\N	\N	\N	\N
485	dylan-strome	Dylan Strome	C	37	8478440	17	\N	\N	\N	\N	\N	\N	\N	\N	\N
487	tom-wilson	Tom Wilson	R	37	8476880	43	\N	\N	\N	\N	\N	\N	\N	\N	\N
488	jakob-chychrun	Jakob Chychrun	D	37	8479345	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
489	vincent-desharnais	Vincent Desharnais	D	37	8479576	73	\N	\N	\N	\N	\N	\N	\N	\N	\N
490	martin-fehrvry	Martin Fehérváry	D	37	8480796	42	\N	\N	\N	\N	\N	\N	\N	\N	\N
492	timothy-liljegren	Timothy Liljegren	D	37	8480043	27	\N	\N	\N	\N	\N	\N	\N	\N	\N
493	dylan-mcilrath	Dylan McIlrath	D	37	8475795	52	\N	\N	\N	\N	\N	\N	\N	\N	\N
494	matt-roy	Matt Roy	D	37	8478911	3	\N	\N	\N	\N	\N	\N	\N	\N	\N
495	rasmus-sandin	Rasmus Sandin	D	37	8480873	38	\N	\N	\N	\N	\N	\N	\N	\N	\N
496	charlie-lindgren	Charlie Lindgren	G	37	8479292	79	\N	\N	\N	\N	\N	\N	\N	\N	\N
497	clay-stevenson	Clay Stevenson	G	37	8483532	33	\N	\N	\N	\N	\N	\N	\N	\N	\N
499	morgan-barron	Morgan Barron	C	38	8480289	36	\N	\N	\N	\N	\N	\N	\N	\N	\N
501	kyle-connor	Kyle Connor	L	38	8478398	81	\N	\N	\N	\N	\N	\N	\N	\N	\N
502	alex-iafallo	Alex Iafallo	L	38	8480113	9	\N	\N	\N	\N	\N	\N	\N	\N	\N
503	cole-koepke	Cole Koepke	L	38	8481043	45	\N	\N	\N	\N	\N	\N	\N	\N	\N
504	adam-lowry	Adam Lowry	C	38	8476392	17	\N	\N	\N	\N	\N	\N	\N	\N	\N
506	nino-niederreiter	Nino Niederreiter	R	38	8475799	62	\N	\N	\N	\N	\N	\N	\N	\N	\N
507	cole-perfetti	Cole Perfetti	C	38	8482149	91	\N	\N	\N	\N	\N	\N	\N	\N	\N
530	nico-myatovic	NICO MYATOVIC	L	317	8484201	48	\N	\N	\N	\N	\N	\N	\N	\N	\N
509	mark-scheifele	Mark Scheifele	C	38	8476460	55	\N	\N	\N	\N	\N	\N	\N	\N	\N
510	gabriel-vilardi	Gabriel Vilardi	C	38	8480014	13	\N	\N	\N	\N	\N	\N	\N	\N	\N
511	dylan-demelo	Dylan DeMelo	D	38	8476331	2	\N	\N	\N	\N	\N	\N	\N	\N	\N
513	haydn-fleury	Haydn Fleury	D	38	8477938	24	\N	\N	\N	\N	\N	\N	\N	\N	\N
514	josh-morrissey	Josh Morrissey	D	38	8477504	44	\N	\N	\N	\N	\N	\N	\N	\N	\N
515	neal-pionk	Neal Pionk	D	38	8480145	4	\N	\N	\N	\N	\N	\N	\N	\N	\N
516	dylan-samberg	Dylan Samberg	D	38	8480049	54	\N	\N	\N	\N	\N	\N	\N	\N	\N
517	john-st-ivany	John St. Ivany	D	38	8481030	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
519	stuart-skinner	Stuart Skinner	G	38	8479973	74	\N	\N	\N	\N	\N	\N	\N	\N	\N
542	travis-mitchell	TRAVIS MITCHELL	D	326	8484262	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
579	konsta-helenius	KONSTA HELENIUS	F	315	8484797	94	\N	\N	\N	\N	\N	\N	\N	\N	\N
562	alex-steeves	ALEX STEEVES	C	314	8482634	21	\N	\N	\N	\N	\N	\N	\N	\N	\N
525	aj-greer	A.J. Greer	L	7	8478421	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
538	tyson-hinds	TYSON HINDS	D	317	8482731	60	\N	\N	\N	\N	\N	\N	\N	\N	\N
527	alex-killorn	Alex Killorn	L	7	8473986	17	\N	\N	\N	\N	\N	\N	\N	\N	\N
528	chris-kreider	Chris Kreider	L	7	8475184	20	\N	\N	\N	\N	\N	\N	\N	\N	\N
529	jeff-malott	Jeff Malott	L	7	8482408	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
567	jordan-harris	JORDAN HARRIS	D	314	8480887	43	\N	\N	\N	\N	\N	\N	\N	\N	\N
531	ryan-poehling	Ryan Poehling	C	7	8480068	25	\N	\N	\N	\N	\N	\N	\N	\N	\N
533	troy-terry	Troy Terry	R	7	8478873	19	\N	\N	\N	\N	\N	\N	\N	\N	\N
534	frank-vatrano	Frank Vatrano	R	7	8478366	77	\N	\N	\N	\N	\N	\N	\N	\N	\N
500	nikita-chibrikov	NIKITA CHIBRIKOV	L	311	8482787	90	\N	\N	\N	\N	\N	\N	\N	\N	\N
552	james-hagens	JAMES HAGENS	F	314	8485395	44	\N	\N	\N	\N	\N	\N	\N	\N	\N
537	drew-helleson	Drew Helleson	D	7	8481563	14	\N	\N	\N	\N	\N	\N	\N	\N	\N
476	ethen-frank	ETHEN FRANK	R	307	8483573	53	\N	\N	\N	\N	\N	\N	\N	\N	\N
539	nick-jensen	Nick Jensen	D	7	8475324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
541	pavel-mintyukov	Pavel Mintyukov	D	7	8483490	98	\N	\N	\N	\N	\N	\N	\N	\N	\N
546	jett-woo	JETT WOO	D	318	8480808	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
480	ivan-miroshnichenko	IVAN MIROSHNICHENKO	L	307	8483491	63	\N	\N	\N	\N	\N	\N	\N	\N	\N
468	jaycob-megna	JAYCOB MEGNA	D	306	8477034	88	\N	\N	\N	\N	\N	\N	\N	\N	\N
483	ilya-protas	ILYA PROTAS	C	307	8484999	62	\N	\N	\N	\N	\N	\N	\N	\N	\N
508	isak-rosen	ISAK ROSEN	R	315	8482765	27	\N	\N	\N	\N	\N	\N	\N	\N	\N
547	laurent-brossoit	Laurent Brossoit	G	7	8476316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
548	lukas-dostal	Lukas Dostal	G	7	8480843	1	\N	\N	\N	\N	\N	\N	\N	\N	\N
550	michael-eyssimont	Michael Eyssimont	C	3	8479591	81	\N	\N	\N	\N	\N	\N	\N	\N	\N
551	morgan-geekie	Morgan Geekie	C	3	8479987	39	\N	\N	\N	\N	\N	\N	\N	\N	\N
543	ian-moore	IAN MOORE	D	317	8482178	3	\N	\N	\N	\N	\N	\N	\N	\N	\N
553	tanner-jeannot	Tanner Jeannot	L	3	8479661	84	\N	\N	\N	\N	\N	\N	\N	\N	\N
554	mark-kastelic	Mark Kastelic	C	3	8480355	47	\N	\N	\N	\N	\N	\N	\N	\N	\N
556	sean-kuraly	Sean Kuraly	C	3	8476374	52	\N	\N	\N	\N	\N	\N	\N	\N	\N
557	elias-lindholm	Elias Lindholm	C	3	8477496	28	\N	\N	\N	\N	\N	\N	\N	\N	\N
558	fraser-minten	Fraser Minten	C	3	8483489	93	\N	\N	\N	\N	\N	\N	\N	\N	\N
559	casey-mittelstadt	Casey Mittelstadt	C	3	8479999	11	\N	\N	\N	\N	\N	\N	\N	\N	\N
560	david-pastrnak	David Pastrnak	R	3	8477956	88	\N	\N	\N	\N	\N	\N	\N	\N	\N
561	jj-peterka	JJ Peterka	R	3	8482175	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
526	james-hamblin	JAMES HAMBLIN	C	296	8480468	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
535	anton-wahlberg	ANTON WAHLBERG	L	315	8484238	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
565	will-borgen	Will Borgen	D	3	8478840	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
566	connor-clifton	Connor Clifton	D	3	8477365	75	\N	\N	\N	\N	\N	\N	\N	\N	\N
544	corey-schueneman	COREY SCHUENEMAN	D	307	8481461	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
568	henri-jokiharju	Henri Jokiharju	D	3	8480035	20	\N	\N	\N	\N	\N	\N	\N	\N	\N
570	mason-lohrei	Mason Lohrei	D	3	8482511	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
571	charlie-mcavoy	Charlie McAvoy	D	3	8479325	73	\N	\N	\N	\N	\N	\N	\N	\N	\N
572	nikita-zadorov	Nikita Zadorov	D	3	8477507	91	\N	\N	\N	\N	\N	\N	\N	\N	\N
573	jeremy-swayman	Jeremy Swayman	G	3	8480280	1	\N	\N	\N	\N	\N	\N	\N	\N	\N
574	zach-benson	Zach Benson	L	9	8484145	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
575	sam-carrick	Sam Carrick	C	9	8475842	10	\N	\N	\N	\N	\N	\N	\N	\N	\N
577	josh-doan	Josh Doan	R	9	8482659	91	\N	\N	\N	\N	\N	\N	\N	\N	\N
536	tim-washe	TIM WASHE	F	317	8485512	42	\N	\N	\N	\N	\N	\N	\N	\N	\N
580	tyson-kozak	Tyson Kozak	C	9	8482896	48	\N	\N	\N	\N	\N	\N	\N	\N	\N
581	peyton-krebs	Peyton Krebs	C	9	8481522	19	\N	\N	\N	\N	\N	\N	\N	\N	\N
582	jiri-kulich	Jiri Kulich	C	9	8483468	20	\N	\N	\N	\N	\N	\N	\N	\N	\N
583	beck-malenstyn	Beck Malenstyn	L	9	8479359	29	\N	\N	\N	\N	\N	\N	\N	\N	\N
469	shea-theodore	Shea Theodore	D	36	8477447	27	\N	\N	\N	\N	\N	\N	\N	\N	\N
470	parker-wotherspoon	Parker Wotherspoon	D	36	8478450	29	\N	\N	\N	\N	\N	\N	\N	\N	\N
523	cutter-gauthier	Cutter Gauthier	L	7	8483445	61	\N	\N	\N	\N	\N	\N	\N	\N	\N
589	tage-thompson	Tage Thompson	C	9	8479420	72	\N	\N	\N	\N	\N	\N	\N	\N	\N
590	jason-zucker	Jason Zucker	L	9	8475722	17	\N	\N	\N	\N	\N	\N	\N	\N	\N
592	rasmus-dahlin	Rasmus Dahlin	D	9	8480839	26	\N	\N	\N	\N	\N	\N	\N	\N	\N
665	andrew-mangiapane	ANDREW MANGIAPANE	R	296	8478233	26	\N	\N	\N	\N	\N	\N	\N	\N	\N
668	landon-slaggert	LANDON SLAGGERT	F	316	8482172	84	\N	\N	\N	\N	\N	\N	\N	\N	\N
626	yan-kuznetsov	YAN KUZNETSOV	D	298	8482165	37	\N	\N	\N	\N	\N	\N	\N	\N	\N
598	owen-power	Owen Power	D	9	8482671	25	\N	\N	\N	\N	\N	\N	\N	\N	\N
599	mattias-samuelsson	Mattias Samuelsson	D	9	8480807	23	\N	\N	\N	\N	\N	\N	\N	\N	\N
600	conor-timmins	Conor Timmins	D	9	8479982	21	\N	\N	\N	\N	\N	\N	\N	\N	\N
601	olen-zellweger	Olen Zellweger	D	9	8482803	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
602	colten-ellis	Colten Ellis	G	9	8481551	92	\N	\N	\N	\N	\N	\N	\N	\N	\N
604	alex-lyon	Alex Lyon	G	9	8479312	34	\N	\N	\N	\N	\N	\N	\N	\N	\N
605	matt-villalta	Matt Villalta	G	9	8480191	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
606	mikael-backlund	Mikael Backlund	C	10	8474150	11	\N	\N	\N	\N	\N	\N	\N	\N	\N
615	rory-kerins	RORY KERINS	C	298	8482209	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
608	joel-farabee	Joel Farabee	L	10	8480797	86	\N	\N	\N	\N	\N	\N	\N	\N	\N
609	morgan-frost	Morgan Frost	C	10	8480028	16	\N	\N	\N	\N	\N	\N	\N	\N	\N
593	dennis-gilbert	DENNIS GILBERT	D	297	8478502	8	\N	\N	\N	\N	\N	\N	\N	\N	\N
612	samuel-honzek	Samuel Honzek	L	10	8484180	29	\N	\N	\N	\N	\N	\N	\N	\N	\N
613	jonathan-huberdeau	Jonathan Huberdeau	L	10	8476456	10	\N	\N	\N	\N	\N	\N	\N	\N	\N
586	noah-ostlund	NOAH OSTLUND	C	315	8483500	86	\N	\N	\N	\N	\N	\N	\N	\N	\N
596	zach-metsa	ZACH METSA	D	315	8484305	73	\N	\N	\N	\N	\N	\N	\N	\N	\N
616	adam-klapka	Adam Klapka	R	10	8483609	43	\N	\N	\N	\N	\N	\N	\N	\N	\N
618	yegor-sharangovich	Yegor Sharangovich	C	10	8481068	17	\N	\N	\N	\N	\N	\N	\N	\N	\N
619	ryan-strome	Ryan Strome	C	10	8476458	22	\N	\N	\N	\N	\N	\N	\N	\N	\N
630	zayne-parekh	ZAYNE PAREKH	D	298	8484768	19	\N	\N	\N	\N	\N	\N	\N	\N	\N
621	maxim-tsyplakov	Maxim Tsyplakov	R	10	8484958	72	\N	\N	\N	\N	\N	\N	\N	\N	\N
622	connor-zary	Connor Zary	C	10	8482074	47	\N	\N	\N	\N	\N	\N	\N	\N	\N
623	kevin-bahl	Kevin Bahl	D	10	8480860	7	\N	\N	\N	\N	\N	\N	\N	\N	\N
625	joel-hanley	Joel Hanley	D	10	8477810	44	\N	\N	\N	\N	\N	\N	\N	\N	\N
614	ben-jones	BEN JONES	C	308	8480259	64	\N	\N	\N	\N	\N	\N	\N	\N	\N
627	jake-middleton	Jake Middleton	D	10	8478136	55	\N	\N	\N	\N	\N	\N	\N	\N	\N
628	simon-nemec	Simon Nemec	D	10	8483495	71	\N	\N	\N	\N	\N	\N	\N	\N	\N
629	brayden-pachal	Brayden Pachal	D	10	8481167	94	\N	\N	\N	\N	\N	\N	\N	\N	\N
664	nick-lardis	NICK LARDIS	F	316	8484185	76	\N	\N	\N	\N	\N	\N	\N	\N	\N
632	abram-wiebe	Abram Wiebe	D	10	8483709	52	\N	\N	\N	\N	\N	\N	\N	\N	\N
633	devin-cooley	Devin Cooley	G	10	8482445	1	\N	\N	\N	\N	\N	\N	\N	\N	\N
634	dustin-wolf	Dustin Wolf	G	10	8481692	32	\N	\N	\N	\N	\N	\N	\N	\N	\N
666	oliver-moore	OLIVER MOORE	F	316	8484197	11	\N	\N	\N	\N	\N	\N	\N	\N	\N
636	jackson-blake	Jackson Blake	R	11	8482809	53	\N	\N	\N	\N	\N	\N	\N	\N	\N
637	william-carrier	William Carrier	L	11	8477478	28	\N	\N	\N	\N	\N	\N	\N	\N	\N
639	nikolaj-ehlers	Nikolaj Ehlers	L	11	8477940	27	\N	\N	\N	\N	\N	\N	\N	\N	\N
640	taylor-hall	Taylor Hall	L	11	8475791	71	\N	\N	\N	\N	\N	\N	\N	\N	\N
641	mark-jankowski	Mark Jankowski	L	11	8476873	77	\N	\N	\N	\N	\N	\N	\N	\N	\N
642	seth-jarvis	Seth Jarvis	R	11	8482093	24	\N	\N	\N	\N	\N	\N	\N	\N	\N
643	jesperi-kotkaniemi	Jesperi Kotkaniemi	C	11	8480829	82	\N	\N	\N	\N	\N	\N	\N	\N	\N
644	jordan-martinook	Jordan Martinook	L	11	8476921	48	\N	\N	\N	\N	\N	\N	\N	\N	\N
645	eric-robinson	Eric Robinson	L	11	8480762	50	\N	\N	\N	\N	\N	\N	\N	\N	\N
647	logan-stankoven	Logan Stankoven	C	11	8482702	22	\N	\N	\N	\N	\N	\N	\N	\N	\N
648	andrei-svechnikov	Andrei Svechnikov	R	11	8480830	37	\N	\N	\N	\N	\N	\N	\N	\N	\N
649	jalen-chatfield	Jalen Chatfield	D	11	8478970	5	\N	\N	\N	\N	\N	\N	\N	\N	\N
651	kandre-miller	K'Andre Miller	D	11	8480817	19	\N	\N	\N	\N	\N	\N	\N	\N	\N
653	jaccob-slavin	Jaccob Slavin	D	11	8476958	74	\N	\N	\N	\N	\N	\N	\N	\N	\N
654	sean-walker	Sean Walker	D	11	8480336	26	\N	\N	\N	\N	\N	\N	\N	\N	\N
655	brandon-bussi	Brandon Bussi	G	11	8483548	32	\N	\N	\N	\N	\N	\N	\N	\N	\N
656	pyotr-kochetkov	Pyotr Kochetkov	G	11	8481611	52	\N	\N	\N	\N	\N	\N	\N	\N	\N
657	connor-bedard	Connor Bedard	C	12	8484144	98	\N	\N	\N	\N	\N	\N	\N	\N	\N
658	tyler-bertuzzi	Tyler Bertuzzi	L	12	8477479	59	\N	\N	\N	\N	\N	\N	\N	\N	\N
659	sacha-boisvert	Sacha Boisvert	C	12	8484793	12	\N	\N	\N	\N	\N	\N	\N	\N	\N
661	anton-frondell	Anton Frondell	C	12	8485391	16	\N	\N	\N	\N	\N	\N	\N	\N	\N
662	ryan-greene	Ryan Greene	C	12	8483450	20	\N	\N	\N	\N	\N	\N	\N	\N	\N
663	jordan-greenway	Jordan Greenway	L	12	8478413	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
635	sebastian-aho	SEBASTIAN AHO	D	325	8478427	20	\N	\N	\N	\N	\N	\N	\N	\N	\N
620	aydar-suniev	AYDAR SUNIEV	L	298	8484234	36	\N	\N	\N	\N	\N	\N	\N	\N	\N
671	dominic-toninato	DOMINIC TONINATO	C	316	8476952	25	\N	\N	\N	\N	\N	\N	\N	\N	\N
610	matvei-gridin	MATVEI GRIDIN	F	298	8484860	92	\N	\N	\N	\N	\N	\N	\N	\N	\N
669	cole-smith	Cole Smith	L	12	8482062	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
670	teuvo-teravainen	Teuvo Teravainen	C	12	8476882	86	\N	\N	\N	\N	\N	\N	\N	\N	\N
678	sam-rinzel	SAM RINZEL	D	316	8483506	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
672	bowen-byram	Bowen Byram	D	12	8481524	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
673	ian-cole	Ian Cole	D	12	8474013	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
675	wyatt-kaiser	Wyatt Kaiser	D	12	8482176	44	\N	\N	\N	\N	\N	\N	\N	\N	\N
694	fedor-svechkov	FEDOR SVECHKOV	C	312	8482768	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
677	artyom-levshunov	Artyom Levshunov	D	12	8484783	55	\N	\N	\N	\N	\N	\N	\N	\N	\N
682	zakhar-bardakov	ZAKHAR BARDAKOV	L	303	8482947	93	\N	\N	\N	\N	\N	\N	\N	\N	\N
679	alex-vlasic	Alex Vlasic	D	12	8481568	72	\N	\N	\N	\N	\N	\N	\N	\N	\N
680	spencer-knight	Spencer Knight	G	12	8481519	30	\N	\N	\N	\N	\N	\N	\N	\N	\N
676	kevin-korchinski	KEVIN KORCHINSKI	D	316	8483466	14	\N	\N	\N	\N	\N	\N	\N	\N	\N
683	vinnie-hinostroza	Vinnie Hinostroza	C	13	8476994	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
684	nazem-kadri	Nazem Kadri	C	13	8475172	91	\N	\N	\N	\N	\N	\N	\N	\N	\N
685	parker-kelly	Parker Kelly	C	13	8480448	17	\N	\N	\N	\N	\N	\N	\N	\N	\N
686	gabriel-landeskog	Gabriel Landeskog	L	13	8476455	92	\N	\N	\N	\N	\N	\N	\N	\N	\N
687	artturi-lehkonen	Artturi Lehkonen	L	13	8477476	62	\N	\N	\N	\N	\N	\N	\N	\N	\N
689	martin-necas	Martin Necas	C	13	8480039	88	\N	\N	\N	\N	\N	\N	\N	\N	\N
690	brock-nelson	Brock Nelson	C	13	8475754	11	\N	\N	\N	\N	\N	\N	\N	\N	\N
691	logan-oconnor	Logan O'Connor	R	13	8481186	25	\N	\N	\N	\N	\N	\N	\N	\N	\N
692	nicolas-roy	Nicolas Roy	C	13	8478462	10	\N	\N	\N	\N	\N	\N	\N	\N	\N
693	jaden-schwartz	Jaden Schwartz	C	13	8475768	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
594	ryan-johnson	RYAN JOHNSON	D	315	8481564	33	\N	\N	\N	\N	\N	\N	\N	\N	\N
696	noah-juulsen	Noah Juulsen	D	13	8478454	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
697	brett-kulak	Brett Kulak	D	13	8476967	27	\N	\N	\N	\N	\N	\N	\N	\N	\N
698	cale-makar	Cale Makar	D	13	8480069	8	\N	\N	\N	\N	\N	\N	\N	\N	\N
699	sam-malinski	Sam Malinski	D	13	8484258	70	\N	\N	\N	\N	\N	\N	\N	\N	\N
700	josh-manson	Josh Manson	D	13	8476312	42	\N	\N	\N	\N	\N	\N	\N	\N	\N
587	jack-quinn	Jack Quinn	R	9	8482097	22	\N	\N	\N	\N	\N	\N	\N	\N	\N
607	matt-coronato	Matt Coronato	R	10	8482679	27	\N	\N	\N	\N	\N	\N	\N	\N	\N
588	conor-sheary	Conor Sheary	L	9	8477839	43	\N	\N	\N	\N	\N	\N	\N	\N	\N
707	kent-johnson	Kent Johnson	C	14	8482660	91	\N	\N	\N	\N	\N	\N	\N	\N	\N
708	ryan-lomberg	Ryan Lomberg	L	14	8479066	94	\N	\N	\N	\N	\N	\N	\N	\N	\N
710	kirill-marchenko	Kirill Marchenko	R	14	8480893	86	\N	\N	\N	\N	\N	\N	\N	\N	\N
711	sean-monahan	Sean Monahan	C	14	8477497	23	\N	\N	\N	\N	\N	\N	\N	\N	\N
712	valeri-nichushkin	Valeri Nichushkin	R	14	8477501	43	\N	\N	\N	\N	\N	\N	\N	\N	\N
713	mathieu-olivier	Mathieu Olivier	R	14	8479671	24	\N	\N	\N	\N	\N	\N	\N	\N	\N
714	cole-sillinger	Cole Sillinger	C	14	8482705	4	\N	\N	\N	\N	\N	\N	\N	\N	\N
715	dmitri-voronkov	Dmitri Voronkov	L	14	8481716	10	\N	\N	\N	\N	\N	\N	\N	\N	\N
716	miles-wood	Miles Wood	L	14	8477425	11	\N	\N	\N	\N	\N	\N	\N	\N	\N
718	dante-fabbro	Dante Fabbro	D	14	8479371	15	\N	\N	\N	\N	\N	\N	\N	\N	\N
719	erik-gudbranson	Erik Gudbranson	D	14	8475790	44	\N	\N	\N	\N	\N	\N	\N	\N	\N
720	denton-mateychuk	Denton Mateychuk	D	14	8483485	5	\N	\N	\N	\N	\N	\N	\N	\N	\N
721	ivan-provorov	Ivan Provorov	D	14	8478500	9	\N	\N	\N	\N	\N	\N	\N	\N	\N
722	damon-severson	Damon Severson	D	14	8476923	78	\N	\N	\N	\N	\N	\N	\N	\N	\N
724	jet-greaves	Jet Greaves	G	14	8482982	73	\N	\N	\N	\N	\N	\N	\N	\N	\N
725	elvis-merzlikins	Elvis Merzlikins	G	14	8478007	90	\N	\N	\N	\N	\N	\N	\N	\N	\N
726	jamie-benn	Jamie Benn	L	15	8473994	14	\N	\N	\N	\N	\N	\N	\N	\N	\N
727	colin-blackwell	Colin Blackwell	C	15	8476278	15	\N	\N	\N	\N	\N	\N	\N	\N	\N
728	oskar-bck	Oskar Bäck	C	15	8480840	10	\N	\N	\N	\N	\N	\N	\N	\N	\N
729	matt-duchene	Matt Duchene	C	15	8475168	95	\N	\N	\N	\N	\N	\N	\N	\N	\N
731	roope-hintz	Roope Hintz	C	15	8478449	24	\N	\N	\N	\N	\N	\N	\N	\N	\N
732	justin-hryckowian	Justin Hryckowian	C	15	8484829	49	\N	\N	\N	\N	\N	\N	\N	\N	\N
217	cameron-crotty	CAMERON CROTTY	D	297	8480075	5	\N	\N	\N	\N	\N	\N	\N	\N	\N
734	wyatt-johnston	Wyatt Johnston	C	15	8482740	53	\N	\N	\N	\N	\N	\N	\N	\N	\N
735	joel-kiviranta	Joel Kiviranta	L	15	8481641	25	\N	\N	\N	\N	\N	\N	\N	\N	\N
737	jason-robertson	Jason Robertson	L	15	8480027	21	\N	\N	\N	\N	\N	\N	\N	\N	\N
738	tyler-seguin	Tyler Seguin	C	15	8475794	91	\N	\N	\N	\N	\N	\N	\N	\N	\N
739	sam-steel	Sam Steel	C	15	8479351	18	\N	\N	\N	\N	\N	\N	\N	\N	\N
740	lian-bichsel	Lian Bichsel	D	15	8483425	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
222	carter-yakemchuk	CARTER YAKEMCHUK	D	297	8484759	58	\N	\N	\N	\N	\N	\N	\N	\N	\N
743	miro-heiskanen	Miro Heiskanen	D	15	8480036	4	\N	\N	\N	\N	\N	\N	\N	\N	\N
744	esa-lindell	Esa Lindell	D	15	8476902	23	\N	\N	\N	\N	\N	\N	\N	\N	\N
745	nils-lundkvist	Nils Lundkvist	D	15	8480878	5	\N	\N	\N	\N	\N	\N	\N	\N	\N
746	tyler-myers	Tyler Myers	D	15	8474574	57	\N	\N	\N	\N	\N	\N	\N	\N	\N
747	casey-desmith	Casey DeSmith	G	15	8479193	1	\N	\N	\N	\N	\N	\N	\N	\N	\N
748	jake-oettinger	Jake Oettinger	G	15	8479979	29	\N	\N	\N	\N	\N	\N	\N	\N	\N
750	viktor-arvidsson	Viktor Arvidsson	L	16	8478042	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
751	jt-compher	J.T. Compher	L	16	8477456	37	\N	\N	\N	\N	\N	\N	\N	\N	\N
752	andrew-copp	Andrew Copp	C	16	8477429	18	\N	\N	\N	\N	\N	\N	\N	\N	\N
753	alex-debrincat	Alex DeBrincat	R	16	8479337	93	\N	\N	\N	\N	\N	\N	\N	\N	\N
754	emmitt-finnie	Emmitt Finnie	C	16	8484471	58	\N	\N	\N	\N	\N	\N	\N	\N	\N
755	marco-kasper	Marco Kasper	C	16	8483464	92	\N	\N	\N	\N	\N	\N	\N	\N	\N
757	dylan-larkin	Dylan Larkin	C	16	8477946	71	\N	\N	\N	\N	\N	\N	\N	\N	\N
758	michael-rasmussen	Michael Rasmussen	C	16	8479992	27	\N	\N	\N	\N	\N	\N	\N	\N	\N
759	lucas-raymond	Lucas Raymond	L	16	8482078	23	\N	\N	\N	\N	\N	\N	\N	\N	\N
760	jacob-bernard-docker	Jacob Bernard-Docker	D	16	8480879	25	\N	\N	\N	\N	\N	\N	\N	\N	\N
761	jacob-bryson	Jacob Bryson	D	16	8480196	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
762	ben-chiarot	Ben Chiarot	D	16	8475279	8	\N	\N	\N	\N	\N	\N	\N	\N	\N
764	justin-faulk	Justin Faulk	D	16	8475753	72	\N	\N	\N	\N	\N	\N	\N	\N	\N
765	albert-johansson	Albert Johansson	D	16	8481607	20	\N	\N	\N	\N	\N	\N	\N	\N	\N
766	moritz-seider	Moritz Seider	D	16	8481542	53	\N	\N	\N	\N	\N	\N	\N	\N	\N
767	john-gibson	John Gibson	G	16	8476434	36	\N	\N	\N	\N	\N	\N	\N	\N	\N
768	daniil-tarasov	Daniil Tarasov	G	16	8480193	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2	colton-dach	Colton Dach	C	1	8482703	34	\N	\N	\N	\N	\N	\N	\N	\N	\N
733	arttu-hyry	ARTTU HYRY	C	321	8484938	25	\N	\N	\N	\N	\N	\N	\N	\N	\N
704	charlie-coyle	Charlie Coyle	C	14	8475745	3	\N	\N	\N	\N	\N	\N	\N	\N	\N
795	sam-bennett	Sam Bennett	C	18	8477935	9	\N	\N	\N	\N	\N	\N	\N	\N	\N
796	lars-eller	Lars Eller	C	18	8474189	20	\N	\N	\N	\N	\N	\N	\N	\N	\N
797	jonah-gadjovich	Jonah Gadjovich	L	18	8479981	12	\N	\N	\N	\N	\N	\N	\N	\N	\N
799	sam-lafferty	Sam Lafferty	C	18	8478043	18	\N	\N	\N	\N	\N	\N	\N	\N	\N
800	anton-lundell	Anton Lundell	C	18	8482113	15	\N	\N	\N	\N	\N	\N	\N	\N	\N
801	eetu-luostarinen	Eetu Luostarinen	C	18	8480185	27	\N	\N	\N	\N	\N	\N	\N	\N	\N
802	brad-marchand	Brad Marchand	L	18	8473419	63	\N	\N	\N	\N	\N	\N	\N	\N	\N
803	cole-reinhardt	Cole Reinhardt	L	18	8481133	29	\N	\N	\N	\N	\N	\N	\N	\N	\N
804	sam-reinhart	Sam Reinhart	C	18	8477933	13	\N	\N	\N	\N	\N	\N	\N	\N	\N
805	cole-schwindt	Cole Schwindt	C	18	8481655	79	\N	\N	\N	\N	\N	\N	\N	\N	\N
807	matthew-tkachuk	Matthew Tkachuk	L	18	8479314	19	\N	\N	\N	\N	\N	\N	\N	\N	\N
808	carter-verhaeghe	Carter Verhaeghe	C	18	8477409	23	\N	\N	\N	\N	\N	\N	\N	\N	\N
809	uvis-balinskis	Uvis Balinskis	D	18	8484304	26	\N	\N	\N	\N	\N	\N	\N	\N	\N
810	aaron-ekblad	Aaron Ekblad	D	18	8477932	5	\N	\N	\N	\N	\N	\N	\N	\N	\N
812	radko-gudas	Radko Gudas	D	18	8475462	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
813	seth-jones	Seth Jones	D	18	8477495	3	\N	\N	\N	\N	\N	\N	\N	\N	\N
814	dmitry-kulikov	Dmitry Kulikov	D	18	8475179	7	\N	\N	\N	\N	\N	\N	\N	\N	\N
815	niko-mikkola	Niko Mikkola	D	18	8478859	77	\N	\N	\N	\N	\N	\N	\N	\N	\N
816	alexander-petrovic	Alexander Petrovic	D	18	8475755	36	\N	\N	\N	\N	\N	\N	\N	\N	\N
817	donovan-sebrango	Donovan Sebrango	D	18	8482131	73	\N	\N	\N	\N	\N	\N	\N	\N	\N
819	akira-schmid	Akira Schmid	G	18	8481033	40	\N	\N	\N	\N	\N	\N	\N	\N	\N
199	michael-amadio	Michael Amadio	R	26	8478020	22	\N	\N	\N	\N	\N	\N	\N	\N	\N
204	dylan-cozens	Dylan Cozens	C	26	8481528	24	\N	\N	\N	\N	\N	\N	\N	\N	\N
248	hunter-mcdonald	HUNTER MCDONALD	D	310	8483760	75	\N	\N	\N	\N	\N	\N	\N	\N	\N
210	hayden-hodgson	HAYDEN HODGSON	R	297	8478173	42	\N	\N	\N	\N	\N	\N	\N	\N	\N
231	sean-couturier	Sean Couturier	C	27	8476461	14	\N	\N	\N	\N	\N	\N	\N	\N	\N
235	nikita-grebenkin	Nikita Grebenkin	R	27	8483733	29	\N	\N	\N	\N	\N	\N	\N	\N	\N
241	owen-tippett	Owen Tippett	R	27	8480015	74	\N	\N	\N	\N	\N	\N	\N	\N	\N
254	aleksei-kolosov	Aleksei Kolosov	G	27	8482783	35	\N	\N	\N	\N	\N	\N	\N	\N	\N
263	hendrix-lapierre	Hendrix Lapierre	C	28	8482148	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
270	elmer-soderblom	Elmer Soderblom	L	28	8481725	25	\N	\N	\N	\N	\N	\N	\N	\N	\N
277	trevor-van-riemsdyk	Trevor van Riemsdyk	D	28	8477845	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
285	mason-marchment	Mason Marchment	L	29	8478975	27	\N	\N	\N	\N	\N	\N	\N	\N	\N
291	alexander-wennberg	Alexander Wennberg	C	29	8477505	21	\N	\N	\N	\N	\N	\N	\N	\N	\N
299	alex-nedeljkovic	Alex Nedeljkovic	G	29	8477968	33	\N	\N	\N	\N	\N	\N	\N	\N	\N
306	bobby-mcmann	Bobby McMann	C	30	8482259	74	\N	\N	\N	\N	\N	\N	\N	\N	\N
532	beckett-sennecke	Beckett Sennecke	R	7	8484762	45	\N	\N	\N	\N	\N	\N	\N	\N	\N
793	aleksander-barkov	Aleksander Barkov	C	18	8477493	16	\N	\N	\N	\N	\N	\N	\N	\N	\N
705	adam-fantilli	Adam Fantilli	C	14	8484166	19	\N	\N	\N	\N	\N	\N	\N	\N	\N
794	john-beecher	John Beecher	C	18	8481556	17	\N	\N	\N	\N	\N	\N	\N	\N	\N
706	conor-garland	Conor Garland	R	14	8478856	83	\N	\N	\N	\N	\N	\N	\N	\N	\N
45	erik-gustafsson	ERIK GUSTAFSSON	D	304	8476979	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
184	adam-sykora	ADAM SYKORA	F	305	8483669	38	\N	\N	\N	\N	\N	\N	\N	\N	\N
443	nikita-tolopilo	Nikita Tolopilo	G	35	8484268	60	\N	\N	\N	\N	\N	\N	\N	\N	\N
450	tomas-hertl	Tomas Hertl	C	36	8476881	48	\N	\N	\N	\N	\N	\N	\N	\N	\N
456	mitch-marner	Mitch Marner	R	36	8478483	93	\N	\N	\N	\N	\N	\N	\N	\N	\N
473	carl-lindbom	Carl Lindbom	G	36	8482761	30	\N	\N	\N	\N	\N	\N	\N	\N	\N
479	ryan-leonard	Ryan Leonard	R	37	8484186	9	\N	\N	\N	\N	\N	\N	\N	\N	\N
486	alex-tuch	Alex Tuch	R	37	8477949	89	\N	\N	\N	\N	\N	\N	\N	\N	\N
491	cole-hutson	Cole Hutson	D	37	8484873	44	\N	\N	\N	\N	\N	\N	\N	\N	\N
498	logan-thompson	Logan Thompson	G	37	8480313	48	\N	\N	\N	\N	\N	\N	\N	\N	\N
505	vladislav-namestnikov	Vladislav Namestnikov	C	38	8476480	7	\N	\N	\N	\N	\N	\N	\N	\N	\N
512	mario-ferraro	Mario Ferraro	D	38	8479983	38	\N	\N	\N	\N	\N	\N	\N	\N	\N
518	connor-hellebuyck	Connor Hellebuyck	G	38	8476945	37	\N	\N	\N	\N	\N	\N	\N	\N	\N
520	leo-carlsson	Leo Carlsson	C	7	8484153	91	\N	\N	\N	\N	\N	\N	\N	\N	\N
798	garnet-hathaway	Garnet Hathaway	R	18	8477903	21	\N	\N	\N	\N	\N	\N	\N	\N	\N
436	victor-mancini	VICTOR MANCINI	D	295	8483768	90	\N	\N	\N	\N	\N	\N	\N	\N	\N
549	ville-husso	Ville Husso	G	7	8478024	33	\N	\N	\N	\N	\N	\N	\N	\N	\N
555	marat-khusnutdinov	Marat Khusnutdinov	C	3	8482177	92	\N	\N	\N	\N	\N	\N	\N	\N	\N
563	pavel-zacha	Pavel Zacha	C	3	8478401	18	\N	\N	\N	\N	\N	\N	\N	\N	\N
569	hampus-lindholm	Hampus Lindholm	D	3	8476854	27	\N	\N	\N	\N	\N	\N	\N	\N	\N
576	justin-danforth	Justin Danforth	R	9	8479941	15	\N	\N	\N	\N	\N	\N	\N	\N	\N
584	ryan-mcleod	Ryan McLeod	C	9	8480802	71	\N	\N	\N	\N	\N	\N	\N	\N	\N
585	josh-norris	Josh Norris	C	9	8480064	9	\N	\N	\N	\N	\N	\N	\N	\N	\N
591	louis-crevier	Louis Crevier	D	9	8481806	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
624	hunter-brzustewicz	HUNTER BRZUSTEWICZ	D	298	8484150	48	\N	\N	\N	\N	\N	\N	\N	\N	\N
603	ukko-pekka-luukkonen	Ukko-Pekka Luukkonen	G	9	8480045	1	\N	\N	\N	\N	\N	\N	\N	\N	\N
611	tyson-gross	Tyson Gross	C	10	8486056	39	\N	\N	\N	\N	\N	\N	\N	\N	\N
806	brady-tkachuk	Brady Tkachuk	L	18	8480801	8	\N	\N	\N	\N	\N	\N	\N	\N	\N
462	dylan-coghlan	DYLAN COGHLAN	D	306	8479639	52	\N	\N	\N	\N	\N	\N	\N	\N	\N
631	zach-whitecloud	Zach Whitecloud	D	10	8480727	28	\N	\N	\N	\N	\N	\N	\N	\N	\N
638	nicolas-deslauriers	Nicolas Deslauriers	L	11	8475235	44	\N	\N	\N	\N	\N	\N	\N	\N	\N
646	jordan-staal	Jordan Staal	C	11	8473533	11	\N	\N	\N	\N	\N	\N	\N	\N	\N
652	alexander-nikishin	Alexander Nikishin	D	11	8482100	21	\N	\N	\N	\N	\N	\N	\N	\N	\N
660	ryan-donato	Ryan Donato	C	12	8477987	8	\N	\N	\N	\N	\N	\N	\N	\N	\N
667	frank-nazar	Frank Nazar	C	12	8483493	91	\N	\N	\N	\N	\N	\N	\N	\N	\N
681	arvid-soderblom	Arvid Soderblom	G	12	8482821	40	\N	\N	\N	\N	\N	\N	\N	\N	\N
688	nathan-mackinnon	Nathan MacKinnon	C	13	8477492	29	\N	\N	\N	\N	\N	\N	\N	\N	\N
695	brent-burns	Brent Burns	D	13	8470613	84	\N	\N	\N	\N	\N	\N	\N	\N	\N
701	devon-toews	Devon Toews	D	13	8478038	7	\N	\N	\N	\N	\N	\N	\N	\N	\N
702	mackenzie-blackwood	Mackenzie Blackwood	G	13	8478406	39	\N	\N	\N	\N	\N	\N	\N	\N	\N
709	isac-lundestrm	Isac Lundeström	C	14	8480806	21	\N	\N	\N	\N	\N	\N	\N	\N	\N
717	jake-christiansen	Jake Christiansen	D	14	8481161	2	\N	\N	\N	\N	\N	\N	\N	\N	\N
723	zach-werenski	Zach Werenski	D	14	8478460	8	\N	\N	\N	\N	\N	\N	\N	\N	\N
730	radek-faksa	Radek Faksa	C	15	8476889	12	\N	\N	\N	\N	\N	\N	\N	\N	\N
736	mikko-rantanen	Mikko Rantanen	R	15	8478420	96	\N	\N	\N	\N	\N	\N	\N	\N	\N
742	thomas-harley	Thomas Harley	D	15	8481581	55	\N	\N	\N	\N	\N	\N	\N	\N	\N
749	mason-appleton	Mason Appleton	C	16	8478891	22	\N	\N	\N	\N	\N	\N	\N	\N	\N
756	keegan-kolesar	Keegan Kolesar	R	16	8478434	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
763	simon-edvinsson	Simon Edvinsson	D	16	8482762	77	\N	\N	\N	\N	\N	\N	\N	\N	\N
4	leon-draisaitl	Leon Draisaitl	C	1	8477934	29	\N	\N	\N	\N	\N	\N	\N	\N	\N
10	kasperi-kapanen	Kasperi Kapanen	R	1	8477953	42	\N	\N	\N	\N	\N	\N	\N	\N	\N
11	ryan-nugent-hopkins	Ryan Nugent-Hopkins	C	1	8476454	93	\N	\N	\N	\N	\N	\N	\N	\N	\N
339	logan-mailloux	LOGAN MAILLOUX	D	319	8482733	23	\N	\N	\N	\N	\N	\N	\N	\N	\N
524	mikael-granlund	Mikael Granlund	C	7	8475798	64	\N	\N	\N	\N	\N	\N	\N	\N	\N
811	gustav-forsling	Gustav Forsling	D	18	8478055	42	\N	\N	\N	\N	\N	\N	\N	\N	\N
25	joel-armia	Joel Armia	R	19	8476469	40	\N	\N	\N	\N	\N	\N	\N	\N	\N
31	alex-laferriere	Alex Laferriere	R	19	8482155	14	\N	\N	\N	\N	\N	\N	\N	\N	\N
40	cody-ceci	Cody Ceci	D	19	8476879	5	\N	\N	\N	\N	\N	\N	\N	\N	\N
345	conor-geekie	CONOR GEEKIE	C	320	8483447	14	\N	\N	\N	\N	\N	\N	\N	\N	\N
52	joel-eriksson-ek	Joel Eriksson Ek	C	20	8478493	14	\N	\N	\N	\N	\N	\N	\N	\N	\N
59	maksim-shabanov	Maksim Shabanov	R	20	8485702	49	\N	\N	\N	\N	\N	\N	\N	\N	\N
75	riley-mercer	Riley Mercer	G	20	8483918	50	\N	\N	\N	\N	\N	\N	\N	\N	\N
82	cole-caufield	Cole Caufield	R	21	8481540	13	\N	\N	\N	\N	\N	\N	\N	\N	\N
88	alex-newhook	Alex Newhook	C	21	8481618	15	\N	\N	\N	\N	\N	\N	\N	\N	\N
94	noah-dobson	Noah Dobson	D	21	8480865	53	\N	\N	\N	\N	\N	\N	\N	\N	\N
101	maksymilian-szuber	Maksymilian Szuber	D	21	8483763	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
109	adam-edstrom	Adam Edstrom	C	22	8481726	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
114	alexander-kerfoot	Alexander Kerfoot	C	22	8477021	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
120	justin-barron	Justin Barron	D	22	8482111	20	\N	\N	\N	\N	\N	\N	\N	\N	\N
127	justus-annunen	Justus Annunen	G	22	8481020	29	\N	\N	\N	\N	\N	\N	\N	\N	\N
134	arseny-gritsyuk	Arseny Gritsyuk	R	23	8481721	81	\N	\N	\N	\N	\N	\N	\N	\N	\N
140	stefan-noesen	Stefan Noesen	R	23	8476474	11	\N	\N	\N	\N	\N	\N	\N	\N	\N
155	simon-holmstrom	Simon Holmstrom	R	24	8481601	92	\N	\N	\N	\N	\N	\N	\N	\N	\N
163	tony-deangelo	Tony DeAngelo	D	24	8477950	77	\N	\N	\N	\N	\N	\N	\N	\N	\N
168	alexander-romanov	Alexander Romanov	D	24	8481014	28	\N	\N	\N	\N	\N	\N	\N	\N	\N
176	pavel-dorofeyev	Pavel Dorofeyev	R	25	8481604	16	\N	\N	\N	\N	\N	\N	\N	\N	\N
4871	ryan-ufko	RYAN UFKO	D	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
190	vladislav-gavrikov	Vladislav Gavrikov	D	25	8478882	44	\N	\N	\N	\N	\N	\N	\N	\N	\N
196	dylan-garand	Dylan Garand	G	25	8482193	33	\N	\N	\N	\N	\N	\N	\N	\N	\N
313	ryker-evans	Ryker Evans	D	30	8482858	41	\N	\N	\N	\N	\N	\N	\N	\N	\N
318	brandon-montour	Brandon Montour	D	30	8477986	62	\N	\N	\N	\N	\N	\N	\N	\N	\N
326	ross-johnston	Ross Johnston	L	31	8477527	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
333	robert-thomas	Robert Thomas	C	31	8480023	18	\N	\N	\N	\N	\N	\N	\N	\N	\N
597	radim-mrtka	RADIM MRTKA	D	315	8485404	57	\N	\N	\N	\N	\N	\N	\N	\N	\N
617	martin-pospisil	MARTIN POSPISIL	C	298	8481028	76	\N	\N	\N	\N	\N	\N	\N	\N	\N
356	brayden-point	Brayden Point	C	32	8478010	21	\N	\N	\N	\N	\N	\N	\N	\N	\N
362	charle-edouard-dastous	Charle-Edouard D'Astous	D	32	8480426	51	\N	\N	\N	\N	\N	\N	\N	\N	\N
372	brandon-duhaime	Brandon Duhaime	R	2	8479520	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
379	auston-matthews	Auston Matthews	C	2	8479318	34	\N	\N	\N	\N	\N	\N	\N	\N	\N
386	oliver-ekman-larsson	Oliver Ekman-Larsson	D	2	8475171	95	\N	\N	\N	\N	\N	\N	\N	\N	\N
394	anthony-stolarz	Anthony Stolarz	G	2	8476932	41	\N	\N	\N	\N	\N	\N	\N	\N	\N
402	clayton-keller	Clayton Keller	R	34	8479343	9	\N	\N	\N	\N	\N	\N	\N	\N	\N
408	kevin-stenlund	Kevin Stenlund	C	34	8478831	82	\N	\N	\N	\N	\N	\N	\N	\N	\N
416	nate-schmidt	Nate Schmidt	D	34	8477220	88	\N	\N	\N	\N	\N	\N	\N	\N	\N
540	jackson-lacombe	Jackson LaCombe	D	7	8481605	2	\N	\N	\N	\N	\N	\N	\N	\N	\N
4836	alex-nylander	ALEX NYLANDER	R	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4837	cameron-hebig	CAMERON HEBIG	C	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4838	cole-guttman	COLE GUTTMAN	F	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4839	sean-farrell	SEAN FARRELL	F	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4841	benoit-olivier-groulx	BENOIT-OLIVIER GROULX	C	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4852	rem-pitlick	REM PITLICK	L	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4853	t-j-tynan	T.J. TYNAN	F	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4854	ben-hemmerling	BEN HEMMERLING	F	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4856	matthew-peca	MATTHEW PECA	C	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4857	mikael-pyyhtia	MIKAEL PYYHTIA	L	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4870	roby-jarventie	ROBY JARVENTIE	R	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
674	ethan-del-mastro	ETHAN DEL MASTRO	D	316	8482807	38	\N	\N	\N	\N	\N	\N	\N	\N	\N
236	carl-grundstrom	CARL GRUNDSTROM	F	310	8479336	91	\N	\N	\N	\N	\N	\N	\N	\N	\N
66	viking-gustafsson-nyberg	VIKING GUSTAFSSON NYBERG	D	308	8486166	6	\N	\N	\N	\N	\N	\N	\N	\N	\N
4802	seth-griffith	SETH GRIFFITH	R	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4804	quinn-hutson	QUINN HUTSON	F	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
818	jacob-markstrom	Jacob Markstrom	G	18	8474593	25	\N	\N	\N	\N	\N	\N	\N	\N	\N
4805	justin-robidas	JUSTIN ROBIDAS	F	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
118	ozzy-wiesblatt	Ozzy Wiesblatt	C	22	8482103	89	\N	\N	\N	\N	\N	\N	\N	\N	\N
146	johnathan-kovacevic	Johnathan Kovacevic	D	23	8480192	8	\N	\N	\N	\N	\N	\N	\N	\N	\N
4806	alex-belzile	ALEX BELZILE	F	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
650	shayne-gostisbehere	Shayne Gostisbehere	D	11	8476906	4	\N	\N	\N	\N	\N	\N	\N	\N	\N
4808	dryden-hunt	DRYDEN HUNT	L	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
703	scott-wedgewood	Scott Wedgewood	G	13	8475809	41	\N	\N	\N	\N	\N	\N	\N	\N	\N
3	jason-dickinson	Jason Dickinson	C	1	8477450	16	\N	\N	\N	\N	\N	\N	\N	\N	\N
4819	dylan-duke	DYLAN DUKE	C	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4820	jagger-firkus	JAGGER FIRKUS	F	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4821	jayson-megna	JAYSON MEGNA	F	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4822	mitchell-chaffee	MITCHELL CHAFFEE	R	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4824	xavier-bourgault	XAVIER BOURGAULT	R	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4825	austin-poganski	AUSTIN POGANSKI	R	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4826	martin-chromiak	MARTIN CHROMIAK	F	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4827	patrick-brown	PATRICK BROWN	F	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4828	riley-tufte	RILEY TUFTE	L	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4829	sasha-pastujov	SASHA PASTUJOV	R	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4830	nikita-alexandrov	NIKITA ALEXANDROV	F	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4831	trey-fix-wolansky	TREY FIX-WOLANSKY	F	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4842	jack-ahcan	JACK AHCAN	D	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4843	matej-blumel	MATEJ BLUMEL	L	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4844	matthew-phillips	MATTHEW PHILLIPS	R	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4845	matthew-seminoff	MATTHEW SEMINOFF	F	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4846	nick-abruzzese	NICK ABRUZZESE	L	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4847	chris-wagner	CHRIS WAGNER	C	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4848	glenn-gawdin	GLENN GAWDIN	F	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4849	isaac-howard	ISAAC HOWARD	L	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4850	jake-lucchini	JAKE LUCCHINI	C	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4851	philippe-daoust	PHILIPPE DAOUST	C	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4858	ryan-carpenter	RYAN CARPENTER	C	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4859	sam-poulin	SAM POULIN	C	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4861	andre-lee	ANDRE LEE	F	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4862	ben-steeves	BEN STEEVES	F	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4864	jimmy-huntington	JIMMY HUNTINGTON	F	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4865	lane-pederson	LANE PEDERSON	C	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4866	ryan-suzuki	RYAN SUZUKI	C	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4867	tristen-nielsen	TRISTEN NIELSEN	F	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4868	colin-white	COLIN WHITE	C	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4869	lukas-cormier	LUKAS CORMIER	D	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4795	jakob-pelletier	JAKOB PELLETIER	L	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4796	cameron-hughes	CAMERON HUGHES	F	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4797	alex-barre-boulet	ALEX BARRE-BOULET	C	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4798	arthur-kaliyev	ARTHUR KALIYEV	L	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4801	felix-unger-sorum	FELIX UNGER SORUM	R	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4809	zac-jones	ZAC JONES	D	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4810	georgii-merkulov	GEORGII MERKULOV	L	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4811	andrew-cristall	ANDREW CRISTALL	L	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4812	filip-bystedt	FILIP BYSTEDT	F	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4813	luca-del-bel-belluz	LUCA DEL BEL BELLUZ	F	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4814	martin-frk	MARTIN FRK	R	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4815	laurent-dauphin	LAURENT DAUPHIN	F	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4816	logan-morrison	LOGAN MORRISON	F	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4817	viljami-marjala	VILJAMI MARJALA	C	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4818	bradly-nadeau	BRADLY NADEAU	F	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4832	brett-seney	BRETT SENEY	F	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4833	john-leonard	JOHN LEONARD	L	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4834	logan-shaw	LOGAN SHAW	F	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4880	luca-pinelli	LUCA PINELLI	L	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4882	aleksanteri-kaskimaki	ALEKSANTERI KASKIMAKI	F	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4883	brett-leason	BRETT LEASON	R	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4884	cole-o-hara	COLE O'HARA	R	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4885	michael-brandsegg-nygard	MICHAEL BRANDSEGG-NYGARD	R	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4886	quentin-musty	QUENTIN MUSTY	F	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4889	graeme-clarke	GRAEME CLARKE	R	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4891	luca-cagnoni	LUCA CAGNONI	D	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4892	mason-shaw	MASON SHAW	R	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4893	matthew-poitras	MATTHEW POITRAS	C	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4894	oliver-wahlstrom	OLIVER WAHLSTROM	R	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4895	amadeus-lombardi	AMADEUS LOMBARDI	C	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4896	ben-berard	BEN BERARD	F	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4897	eduards-tralmaks	EDUARDS TRALMAKS	L	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4898	fabian-lysell	FABIAN LYSELL	R	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4899	gerry-mayhew	GERRY MAYHEW	C	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4900	vinni-lettieri	VINNI LETTIERI	C	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4901	jack-becker	JACK BECKER	F	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4903	justin-bailey	JUSTIN BAILEY	R	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4904	nils-aman	NILS AMAN	C	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4906	atro-leppanen	ATRO LEPPANEN	D	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4908	egor-afanasyev	EGOR AFANASYEV	L	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4909	kenny-connors	KENNY CONNORS	F	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4910	phil-tomasino	PHIL TOMASINO	R	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4912	valtteri-puustinen	VALTTERI PUUSTINEN	R	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4913	xavier-parent	XAVIER PARENT	F	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4914	andrew-agozzino	ANDREW AGOZZINO	C	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4916	artem-shlaine	ARTEM SHLAINE	F	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4917	calle-rosen	CALLE ROSEN	D	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4918	daniil-miromanov	DANIIL MIROMANOV	D	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4919	dominik-shine	DOMINIK SHINE	F	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4920	frederic-brunet	FREDERIC BRUNET	D	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4922	lleyton-roed	LLEYTON ROED	F	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4923	mitch-mclain	MITCH MCLAIN	F	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4924	nicolas-aube-kubel	NICOLAS AUBE-KUBEL	R	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4926	samuel-blais	SAMUEL BLAIS	L	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4927	brendan-brisson	BRENDAN BRISSON	F	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4928	cross-hanas	CROSS HANAS	F	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4929	dillon-dube	DILLON DUBE	L	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4930	dylan-gambrell	DYLAN GAMBRELL	C	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4932	sam-morton	SAM MORTON	C	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4933	sandis-vilmanis	SANDIS VILMANIS	F	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4934	ty-mueller	TY MUELLER	C	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4935	wilmer-skoog	WILMER SKOOG	F	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4936	angus-crookshank	ANGUS CROOKSHANK	L	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4937	brendan-gaunce	BRENDAN GAUNCE	C	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4938	brian-pinho	BRIAN PINHO	F	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4939	christian-kyrou	CHRISTIAN KYROU	D	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4940	cooper-marody	COOPER MARODY	F	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4943	domenick-fensore	DOMENICK FENSORE	D	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4944	jack-williams	JACK WILLIAMS	C	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4946	jaret-anderson-dolan	JARET ANDERSON-DOLAN	C	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4947	ryan-tverberg	RYAN TVERBERG	F	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4948	trevor-kuntar	TREVOR KUNTAR	L	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
95	adam-engstrom	ADAM ENGSTROM	D	309	8483686	42	\N	\N	\N	\N	\N	\N	\N	\N	\N
4950	evan-vierling	EVAN VIERLING	F	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4951	francesco-pinelli	FRANCESCO PINELLI	F	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4953	jacob-quillan	JACOB QUILLAN	C	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4954	juraj-pekarcik	JURAJ PEKARCIK	F	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4956	kole-lind	KOLE LIND	F	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4957	kyle-criscuolo	KYLE CRISCUOLO	C	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4958	matyas-sapovaliv	MATYAS SAPOVALIV	F	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4960	owen-sillinger	OWEN SILLINGER	C	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4961	samuel-fagemo	SAMUEL FAGEMO	L	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4962	ty-nelson	TY NELSON	D	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4963	antonio-stranges	ANTONIO STRANGES	F	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4964	brian-halonen	BRIAN HALONEN	F	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4965	danila-klimovich	DANILA KLIMOVICH	R	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4966	derrick-pouliot	DERRICK POULIOT	D	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4968	oscar-fisker-m-lgaard	OSCAR FISKER MøLGAARD	F	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4969	phillip-di-giuseppe	PHILLIP DI GIUSEPPE	L	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4970	sam-colangelo	SAM COLANGELO	F	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4971	walker-duehr	WALKER DUEHR	R	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4972	igor-chernyshov	IGOR CHERNYSHOV	F	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4973	jani-nyman	JANI NYMAN	F	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4974	joey-anderson	JOEY ANDERSON	R	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4975	louie-belpedio	LOUIE BELPEDIO	D	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4977	noel-gunler	NOEL GUNLER	R	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4979	skyler-brind-amour	SKYLER BRIND'AMOUR	F	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4980	danil-gushchin	DANIL GUSHCHIN	F	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4982	gustav-olofsson	GUSTAV OLOFSSON	D	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4983	harrison-scott	HARRISON SCOTT	F	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4984	matteo-pietroniro	MATTEO PIETRONIRO	D	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4986	robert-mastrosimone	ROBERT MASTROSIMONE	L	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4987	tye-felhaber	TYE FELHABER	F	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4988	wojciech-stachowiak	WOJCIECH STACHOWIAK	C	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4989	calen-addison	CALEN ADDISON	D	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4990	carson-meyer	CARSON MEYER	R	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4991	christian-wolanin	CHRISTIAN WOLANIN	D	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4992	daniel-carr	DANIEL CARR	L	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4993	garrett-pilon	GARRETT PILON	C	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4874	tyson-jugnauth	TYSON JUGNAUTH	D	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4875	william-stromgren	WILLIAM STROMGREN	L	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4876	anthony-richard	ANTHONY RICHARD	L	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4877	bogdan-trineyev	BOGDAN TRINEYEV	R	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4878	jack-devine	JACK DEVINE	F	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4879	joshua-roy	JOSHUA ROY	L	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5004	brayden-yager	BRAYDEN YAGER	C	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5005	jack-studnicka	JACK STUDNICKA	F	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5006	jared-wright	JARED WRIGHT	F	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5007	nate-smith	NATE SMITH	C	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5008	olle-lycksell	OLLE LYCKSELL	R	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5009	william-villeneuve	WILLIAM VILLENEUVE	D	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5010	wyatt-bongiovanni	WYATT BONGIOVANNI	C	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5012	antti-tuomisto	ANTTI TUOMISTO	D	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5014	dysin-mayo	DYSIN MAYO	D	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5016	isaak-phillips	ISAAK PHILLIPS	D	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5017	jakub-rychlovsky	JAKUB RYCHLOVSKY	L	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5018	joakim-kemell	JOAKIM KEMELL	F	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5019	justin-dowling	JUSTIN DOWLING	C	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5021	oskar-olausson	OSKAR OLAUSSON	F	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5022	sammy-walker	SAMMY WALKER	F	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5024	travis-boyd	TRAVIS BOYD	F	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5025	yegor-sidorov	YEGOR SIDOROV	R	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5026	aatu-jamsen	AATU JAMSEN	F	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5027	brendan-furry	BRENDAN FURRY	L	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5028	dans-locmelis	DANS LOCMELIS	C	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5030	michael-karow	MICHAEL KAROW	D	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5031	nikita-pavlychev	NIKITA PAVLYCHEV	C	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5032	ondrej-becher	ONDREJ BECHER	C	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5033	reid-schaefer	REID SCHAEFER	L	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5034	ryan-schmelzer	RYAN SCHMELZER	C	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5035	zach-l-heureux	ZACH L'HEUREUX	L	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5036	clark-bishop	CLARK BISHOP	C	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5037	curtis-mckenzie	CURTIS MCKENZIE	F	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5038	ethan-gauthier	ETHAN GAUTHIER	R	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5039	filip-mesar	FILIP MESAR	R	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5040	ian-mitchell	IAN MITCHELL	D	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5041	lucas-mercuri	LUCAS MERCURI	C	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5042	marc-del-gaizo	MARC DEL GAIZO	D	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5043	mitchell-stephens	MITCHELL STEPHENS	F	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5045	topias-vilen	TOPIAS VILEN	D	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5046	tucker-robertson	TUCKER ROBERTSON	F	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5047	tyler-angle	TYLER ANGLE	R	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5048	zayde-wisdom	ZAYDE WISDOM	C	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5051	cam-lund	CAM LUND	F	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5052	chase-wouters	CHASE WOUTERS	C	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5053	eduard-sale	EDUARD SALE	F	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5055	gavin-hayes	GAVIN HAYES	F	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5056	ivan-ivan	IVAN IVAN	F	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5057	jackson-hallum	JACKSON HALLUM	F	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5058	jagger-joshua	JAGGER JOSHUA	L	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5059	jonas-r-ndbjerg	JONAS RøNDBJERG	F	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5060	jonathan-gruden	JONATHAN GRUDEN	C	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5062	lucas-carlsson	LUCAS CARLSSON	D	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5063	marc-johnstone	MARC JOHNSTONE	R	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5064	matthew-barbolini	MATTHEW BARBOLINI	F	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5065	matyas-melovsky	MATYAS MELOVSKY	F	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5066	max-szuber	MAX SZUBER	D	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5067	parker-ford	PARKER FORD	R	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5068	roland-mckeown	ROLAND MCKEOWN	D	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5069	samuel-savoie	SAMUEL SAVOIE	F	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5070	trey-taylor	TREY TAYLOR	D	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5072	alexis-gendron	ALEXIS GENDRON	F	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5073	boris-katchouk	BORIS KATCHOUK	L	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5074	borya-valis	BORYA VALIS	F	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5076	dylan-roobroeck	DYLAN ROOBROECK	F	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5077	hunter-mckown	HUNTER MCKOWN	C	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5078	jack-thompson	JACK THOMPSON	D	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5079	jared-davidson	JARED DAVIDSON	F	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
174	jaroslav-chmelar	JAROSLAV CHMELAR	F	305	8482877	49	\N	\N	\N	\N	\N	\N	\N	\N	\N
5081	josiah-slavin	JOSIAH SLAVIN	L	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5082	justin-pearson	JUSTIN PEARSON	L	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5083	kale-clague	KALE CLAGUE	D	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5084	lassi-thomson	LASSI THOMSON	D	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5085	lenni-hameenaho	LENNI HAMEENAHO	F	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5086	nick-cicek	NICK CICEK	D	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5087	riley-heidt	RILEY HEIDT	C	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5088	roman-ahcan	ROMAN AHCAN	L	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5089	trevor-carrick	TREVOR CARRICK	D	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5090	alex-suzdalev	ALEX SUZDALEV	R	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5091	arshdeep-bains	ARSHDEEP BAINS	L	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5092	austin-watson	AUSTIN WATSON	R	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5094	corson-ceulemans	CORSON CEULEMANS	D	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5095	danny-zhilkin	DANNY ZHILKIN	C	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5096	dylan-peterson	DYLAN PETERSON	F	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5097	j-r-avon	J.R. AVON	F	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5098	jean-luc-foudy	JEAN-LUC FOUDY	R	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5099	john-hayden	JOHN HAYDEN	F	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5100	karsen-dorwart	KARSEN DORWART	F	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5102	koehn-ziemmer	KOEHN ZIEMMER	F	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5103	maxence-guenette	MAXENCE GUENETTE	D	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5104	nikolas-brouillard	NIKOLAS BROUILLARD	D	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5105	olivier-nadeau	OLIVIER NADEAU	R	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5106	patrick-giles	PATRICK GILES	F	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5107	taylor-makar	TAYLOR MAKAR	F	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5108	tristan-allard	TRISTAN ALLARD	C	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5109	tristan-bertucci	TRISTAN BERTUCCI	D	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5110	viktor-neuchev	VIKTOR NEUCHEV	R	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5111	brennan-othmann	BRENNAN OTHMANN	L	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4995	hugh-mcging	HUGH MCGING	F	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4996	jakub-brabenec	JAKUB BRABENEC	F	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4998	michael-benning	MICHAEL BENNING	D	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4999	nolan-foote	NOLAN FOOTE	L	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5000	oasiz-wiesblatt	OASIZ WIESBLATT	C	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5001	samuel-bolduc	SAMUEL BOLDUC	D	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5121	kevin-lombardi	KEVIN LOMBARDI	F	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5122	noah-chadwick	NOAH CHADWICK	D	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5123	rhett-pitlick	RHETT PITLICK	R	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5124	sean-behrens	SEAN BEHRENS	D	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5125	shane-lachance	SHANE LACHANCE	F	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5127	tanner-molendyk	TANNER MOLENDYK	D	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5128	ty-tullio	TY TULLIO	R	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5129	wyatt-aamodt	WYATT AAMODT	D	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5130	aidan-thompson	AIDAN THOMPSON	F	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5131	akil-thomas	AKIL THOMAS	F	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5132	ben-gleason	BEN GLEASON	D	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5133	cedric-pare	CEDRIC PARE	F	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5134	damien-carfagna	DAMIEN CARFAGNA	D	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5135	david-edstrom	DAVID EDSTROM	C	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5136	henry-thrun	HENRY THRUN	D	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5137	jake-leschyshyn	JAKE LESCHYSHYN	C	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5138	jan-mysak	JAN MYSAK	C	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5139	joey-abate	JOEY ABATE	L	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5140	joey-willis	JOEY WILLIS	L	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5141	matt-strome	MATT STROME	C	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5142	ronan-seeley	RONAN SEELEY	D	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5143	will-butcher	WILL BUTCHER	D	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5144	brett-berard	BRETT BERARD	F	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5146	gabriel-seger	GABRIEL SEGER	L	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5147	jason-polin	JASON POLIN	F	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5148	joe-hicketts	JOE HICKETTS	D	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5149	jorian-donovan	JORIAN DONOVAN	D	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5150	justin-kirkland	JUSTIN KIRKLAND	C	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5151	maxim-groshev	MAXIM GROSHEV	D	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5152	mike-hardman	MIKE HARDMAN	L	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5153	noel-nordh	NOEL NORDH	F	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5154	nolan-allan	NOLAN ALLAN	D	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5155	riese-gaber	RIESE GABER	F	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5156	sawyer-mynio	SAWYER MYNIO	D	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5158	thomas-bordeleau	THOMAS BORDELEAU	F	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
465	ville-heinola	VILLE HEINOLA	D	311	8481572	14	\N	\N	\N	\N	\N	\N	\N	\N	\N
5160	william-lagesson	WILLIAM LAGESSON	D	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5161	caedan-bankier	CAEDAN BANKIER	C	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5162	cam-dineen	CAM DINEEN	D	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5164	kirill-kudryavtsev	KIRILL KUDRYAVTSEV	D	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5165	marc-andre-gaudet	MARC-ANDRE GAUDET	D	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5166	nathan-legare	NATHAN LEGARE	R	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5167	scott-morrow	SCOTT MORROW	D	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5168	tuomas-uronen	TUOMAS URONEN	F	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5169	ty-gallagher	TY GALLAGHER	D	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5170	william-trudeau	WILLIAM TRUDEAU	D	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5171	aleksi-heimosalmi	ALEKSI HEIMOSALMI	D	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5172	angus-booth	ANGUS BOOTH	D	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5175	carson-rehkopf	CARSON REHKOPF	F	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5176	danton-heinen	DANTON HEINEN	L	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5177	gabriel-szturc	GABRIEL SZTURC	C	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5178	guillaume-richard	GUILLAUME RICHARD	D	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5179	jack-rathbone	JACK RATHBONE	D	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5180	jacob-melanson	JACOB MELANSON	F	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5181	jakub-stancl	JAKUB STANCL	F	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5182	lukas-reichel	LUKAS REICHEL	C	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5184	nikita-novikov	NIKITA NOVIKOV	D	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5186	owen-allard	OWEN ALLARD	F	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5187	riley-duran	RILEY DURAN	R	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5189	scott-harrington	SCOTT HARRINGTON	D	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5190	william-wallinder	WILLIAM WALLINDER	D	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5191	cal-foote	CAL FOOTE	D	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5192	connor-mackey	CONNOR MACKEY	D	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5194	ethan-samson	ETHAN SAMSON	D	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5195	grant-cruikshank	GRANT CRUIKSHANK	C	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5196	hudson-fasching	HUDSON FASCHING	R	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5197	hunter-skinner	HUNTER SKINNER	D	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5199	james-malatesta	JAMES MALATESTA	L	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5200	jeremie-poirier	JEREMIE POIRIER	D	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5201	jimmy-schuldt	JIMMY SCHULDT	D	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5202	john-farinacci	JOHN FARINACCI	C	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5203	jordan-dumais	JORDAN DUMAIS	R	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5205	mikulas-hovorka	MIKULAS HOVORKA	D	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5208	seamus-casey	SEAMUS CASEY	D	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5210	billy-sweezey	BILLY SWEEZEY	D	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5211	dylan-anhorn	DYLAN ANHORN	D	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5214	jake-livingstone	JAKE LIVINGSTONE	D	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5215	jamieson-rees	JAMIESON REES	L	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5216	jan-jenik	JAN JENIK	F	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5218	lucas-condotta	LUCAS CONDOTTA	L	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5219	michal-kunc	MICHAL KUNC	F	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5221	noah-gregor	NOAH GREGOR	C	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5222	noah-philp	NOAH PHILP	C	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5223	riley-stillman	RILEY STILLMAN	D	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5224	robbie-russo	ROBBIE RUSSO	D	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5225	ronnie-attard	RONNIE ATTARD	D	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5226	anthony-vincent	ANTHONY VINCENT	F	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5227	anton-blidh	ANTON BLIDH	F	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5228	austin-strand	AUSTIN STRAND	D	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5229	cam-squires	CAM SQUIRES	F	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5230	carter-mazur	CARTER MAZUR	R	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5231	colby-barlow	COLBY BARLOW	R	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5233	logan-brown	LOGAN BROWN	F	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5113	casey-fitzgerald	CASEY FITZGERALD	D	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5116	ethan-edwards	ETHAN EDWARDS	D	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5117	gracyn-sawchyn	GRACYN SAWCHYN	C	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5118	isaac-ratcliffe	ISAAC RATCLIFFE	L	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5119	jake-schmaltz	JAKE SCHMALTZ	C	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5120	juuso-valimaki	JUUSO VALIMAKI	D	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5241	viliam-kmec	VILIAM KMEC	D	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5242	ville-ottavainen	VILLE OTTAVAINEN	D	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5243	zach-aston-reese	ZACH ASTON-REESE	L	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5244	alex-kannok-leipert	ALEX KANNOK LEIPERT	D	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5245	cal-burke	CAL BURKE	C	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5247	dmitry-kuzmin	DMITRY KUZMIN	D	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5248	ethan-cardwell	ETHAN CARDWELL	F	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5249	garrett-wilson	GARRETT WILSON	L	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5250	jack-peart	JACK PEART	D	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5251	joe-fleming	JOE FLEMING	F	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5252	kyle-marino	KYLE MARINO	R	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5253	martin-misiak	MARTIN MISIAK	F	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5254	matt-benning	MATT BENNING	D	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5256	nate-danielson	NATE DANIELSON	C	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5257	nikita-nesterenko	NIKITA NESTERENKO	L	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5258	oscar-eklind	OSCAR EKLIND	F	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5259	reese-johnson	REESE JOHNSON	R	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5260	tyler-pitlick	TYLER PITLICK	F	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5262	alex-doucet	ALEX DOUCET	L	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5263	andrei-loshko	ANDREI LOSHKO	F	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5264	brad-lambert	BRAD LAMBERT	F	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5266	carter-king	CARTER KING	C	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5267	dominik-badinka	DOMINIK BADINKA	D	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5269	justin-holl	JUSTIN HOLL	D	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5270	keaton-middleton	KEATON MIDDLETON	D	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5271	luke-tuch	LUKE TUCH	L	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5272	marc-mclaughlin	MARC MCLAUGHLIN	F	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5273	ryan-mast	RYAN MAST	D	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5274	ryder-rolston	RYDER ROLSTON	F	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5276	shai-buium	SHAI BUIUM	D	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5277	theo-lindstein	THEO LINDSTEIN	D	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5278	zach-dean	ZACH DEAN	F	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5279	alex-gagne	ALEX GAGNE	D	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5281	andrew-gibson	ANDREW GIBSON	D	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5282	artem-duda	ARTEM DUDA	D	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5284	david-gucciardi	DAVID GUCCIARDI	D	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5286	devin-kaplan	DEVIN KAPLAN	F	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5287	donavan-houle	DONAVAN HOULE	F	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5289	hunter-st-martin	HUNTER ST. MARTIN	F	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5290	josh-brown	JOSH BROWN	D	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5291	kaden-hammell	KADEN HAMMELL	D	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5292	kirill-kirsanov	KIRILL KIRSANOV	D	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5293	mark-senden	MARK SENDEN	F	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5294	mathieu-cataford	MATHIEU CATAFORD	F	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5295	sonny-milano	SONNY MILANO	L	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5296	turner-ottenbreit	TURNER OTTENBREIT	D	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5297	ashton-sautner	ASHTON SAUTNER	D	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5298	ayrton-martino	AYRTON MARTINO	F	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5299	braden-hache	BRADEN HACHE	D	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5300	bradley-marek	BRADLEY MAREK	F	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5301	caleb-macdonald	CALEB MACDONALD	D	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5302	chase-bradley	CHASE BRADLEY	F	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5303	gavin-white	GAVIN WHITE	D	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5305	jon-mcdonald	JON MCDONALD	D	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5306	julian-lutz	JULIAN LUTZ	F	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5307	julien-gauthier	JULIEN GAUTHIER	R	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5308	luke-prokop	LUKE PROKOP	D	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5309	marek-alscher	MAREK ALSCHER	D	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5311	matvey-petrov	MATVEY PETROV	R	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5312	nikita-prishchepov	NIKITA PRISHCHEPOV	F	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5313	pavol-regenda	PAVOL REGENDA	L	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5314	ryan-mcgregor	RYAN MCGREGOR	C	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5315	spencer-smallman	SPENCER SMALLMAN	C	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5316	tobias-bjornfot	TOBIAS BJORNFOT	D	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
595	vsevolod-komarov	VSEVOLOD KOMAROV	D	315	8483732	76	\N	\N	\N	\N	\N	\N	\N	\N	\N
5319	xavier-simoneau	XAVIER SIMONEAU	C	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5320	alec-regula	ALEC REGULA	D	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5321	bennett-schimek	BENNETT SCHIMEK	R	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5322	brandon-scanlin	BRANDON SCANLIN	D	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5323	brendan-hoffmann	BRENDAN HOFFMANN	F	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5324	brendan-warren	BRENDAN WARREN	R	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5325	cole-clayton	COLE CLAYTON	D	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5327	gleb-trikozov	GLEB TRIKOZOV	L	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5329	jake-wise	JAKE WISE	F	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5330	kevin-gravel	KEVIN GRAVEL	D	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5332	ludvig-jansson	LUDVIG JANSSON	D	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5333	lukas-dragicevic	LUKAS DRAGICEVIC	D	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5334	mackenzie-entwistle	MACKENZIE ENTWISTLE	R	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5335	maros-jedlicka	MAROS JEDLICKA	F	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5336	michael-buchinger	MICHAEL BUCHINGER	D	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5337	michael-pezzetta	MICHAEL PEZZETTA	L	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5338	miko-matikka	MIKO MATIKKA	F	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5339	nate-clurman	NATE CLURMAN	D	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5340	nick-poisson	NICK POISSON	C	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5342	samuel-johannesson	SAMUEL JOHANNESSON	D	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5343	simon-lundmark	SIMON LUNDMARK	D	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5344	tate-singleton	TATE SINGLETON	R	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5345	tobie-bisson	TOBIE BISSON	D	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5347	beau-akey	BEAU AKEY	D	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5348	caden-price	CADEN PRICE	D	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5350	david-goyette	DAVID GOYETTE	F	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5351	david-silye	DAVID SILYE	C	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5352	dino-kambeitz	DINO KAMBEITZ	R	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5235	luke-krys	LUKE KRYS	D	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5237	michael-callahan	MICHAEL CALLAHAN	D	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5238	otto-stenberg	OTTO STENBERG	F	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5239	ryan-chesley	RYAN CHESLEY	D	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5240	tyler-thorpe	TYLER THORPE	R	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5361	lleyton-moore	LLEYTON MOORE	D	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5362	mitchell-vande-sompel	MITCHELL VANDE SOMPEL	D	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5363	montana-onyebuchi	MONTANA ONYEBUCHI	D	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5366	samu-tuomaala	SAMU TUOMAALA	F	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5367	tommy-miller	TOMMY MILLER	D	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5369	blake-smith	BLAKE SMITH	D	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5370	brody-lamb	BRODY LAMB	F	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5371	chas-sharpe	CHAS SHARPE	D	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5372	chase-stillman	CHASE STILLMAN	R	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5374	ian-mckinnon	IAN MCKINNON	F	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5375	ivan-ryabkin	IVAN RYABKIN	C	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5376	jack-malone	JACK MALONE	F	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5377	jack-millar	JACK MILLAR	D	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5379	jujhar-khaira	JUJHAR KHAIRA	C	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5380	lucas-ciona	LUCAS CIONA	L	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5381	matteo-costantini	MATTEO COSTANTINI	C	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5382	noah-laaouan	NOAH LAAOUAN	D	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5383	ryan-sandelin	RYAN SANDELIN	F	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5384	taige-harding	TAIGE HARDING	D	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5385	vilmer-alriksson	VILMER ALRIKSSON	L	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5386	wyatt-newpower	WYATT NEWPOWER	D	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5387	adam-ginning	ADAM GINNING	D	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5389	blake-hillman	BLAKE HILLMAN	D	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5390	bryan-yoon	BRYAN YOON	D	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5392	cooper-moore	COOPER MOORE	D	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5393	daniel-walcott	DANIEL WALCOTT	L	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5394	dillon-boucher	DILLON BOUCHER	F	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5395	elias-salomonsson	ELIAS SALOMONSSON	D	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5397	jackson-cates	JACKSON CATES	F	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5398	jarred-tinordi	JARRED TINORDI	D	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5399	kalan-lind	KALAN LIND	L	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5400	kyle-looft	KYLE LOOFT	D	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5401	mackenzie-maceachern	MACKENZIE MACEACHERN	L	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5402	mark-duarte	MARK DUARTE	R	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5403	mason-millman	MASON MILLMAN	D	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5404	max-mccue	MAX MCCUE	C	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5405	mikael-diotte	MIKAEL DIOTTE	D	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5406	sam-lipkin	SAM LIPKIN	F	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5408	vladislav-kolyachonok	VLADISLAV KOLYACHONOK	D	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5409	anton-johansson	ANTON JOHANSSON	D	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5410	austin-roest	AUSTIN ROEST	C	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5411	cam-allen	CAM ALLEN	D	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5412	carson-bantle	CARSON BANTLE	L	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5413	cavan-fitzgerald	CAVAN FITZGERALD	D	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5414	colton-white	COLTON WHITE	D	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5415	dakota-mermis	DAKOTA MERMIS	D	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5416	dalton-bancroft	DALTON BANCROFT	R	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5417	dalton-smith	DALTON SMITH	L	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5418	dmitry-osipov	DMITRY OSIPOV	D	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5420	graham-slaggert	GRAHAM SLAGGERT	L	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5421	jacob-julien	JACOB JULIEN	C	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5422	jalen-luypen	JALEN LUYPEN	C	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5423	joe-arntsen	JOE ARNTSEN	D	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5424	justin-ertel	JUSTIN ERTEL	L	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5425	juuso-parssinen	JUUSO PARSSINEN	C	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5426	leon-muggli	LEON MUGGLI	D	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5427	lucas-vanroboys	LUCAS VANROBOYS	F	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5428	nikita-susuyev	NIKITA SUSUYEV	F	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5429	nikolai-knyzhov	NIKOLAI KNYZHOV	D	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5430	riley-bezeau	RILEY BEZEAU	R	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5431	ryan-gagnier	RYAN GAGNIER	C	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5432	sam-bitten	SAM BITTEN	L	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5433	simon-robertsson	SIMON ROBERTSSON	F	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5434	stanislav-svozil	STANISLAV SVOZIL	D	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5436	aaron-ness	AARON NESS	D	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5437	brandon-hickey	BRANDON HICKEY	D	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5438	colton-huard	COLTON HUARD	D	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5440	dylan-hryckowian	DYLAN HRYCKOWIAN	F	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5441	eamon-powell	EAMON POWELL	D	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5442	ethan-keppen	ETHAN KEPPEN	R	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5443	gavin-brindley	GAVIN BRINDLEY	R	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5445	isaac-belliveau	ISAAC BELLIVEAU	D	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5446	jack-matier	JACK MATIER	D	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5447	jakub-dvorak	JAKUB DVORAK	D	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5448	josh-filmon	JOSH FILMON	F	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5449	kai-schwindt	KAI SCHWINDT	F	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5450	kenta-isogai	KENTA ISOGAI	F	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5451	kyle-crnkovic	KYLE CRNKOVIC	F	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5452	leo-loof	LEO LOOF	D	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5453	liam-mclinskey	LIAM MCLINSKEY	F	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5454	michael-milne	MICHAEL MILNE	F	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5455	parker-bell	PARKER BELL	L	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5456	red-savage	RED SAVAGE	C	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5457	sean-chisholm	SEAN CHISHOLM	F	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5458	shawn-element	SHAWN ELEMENT	L	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5460	steven-santini	STEVEN SANTINI	D	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5461	tomas-hamara	TOMAS HAMARA	D	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5462	tommy-bergsland	TOMMY BERGSLAND	D	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5463	ty-murchison	TY MURCHISON	D	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5464	andrew-basha	ANDREW BASHA	L	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5465	cooper-walker	COOPER WALKER	C	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5467	dennis-cholowski	DENNIS CHOLOWSKI	D	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5470	givani-smith	GIVANI SMITH	L	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5353	jack-ricketts	JACK RICKETTS	F	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5354	jackson-dorrington	JACKSON DORRINGTON	D	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5355	jakov-novak	JAKOV NOVAK	F	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5358	joel-nystrom	JOEL NYSTROM	D	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5359	joseph-labate	JOSEPH LABATE	C	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5360	kyle-mcdonald	KYLE MCDONALD	R	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5478	luke-mittelstadt	LUKE MITTELSTADT	D	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5479	marshall-rifai	MARSHALL RIFAI	D	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5480	massimo-rizzo	MASSIMO RIZZO	F	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5481	otto-salin	OTTO SALIN	D	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5482	quinton-burns	QUINTON BURNS	D	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5483	rasmus-kumpulainen	RASMUS KUMPULAINEN	F	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5484	shane-bowers	SHANE BOWERS	F	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5485	sloan-stanick	SLOAN STANICK	F	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5486	tyler-kopff	TYLER KOPFF	L	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5487	tyrel-bauer	TYREL BAUER	D	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5488	vincent-arseneau	VINCENT ARSENEAU	L	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5489	will-dineen	WILL DINEEN	F	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5490	will-zmolek	WILL ZMOLEK	D	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5491	zach-uens	ZACH UENS	D	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5493	andrew-perrott	ANDREW PERROTT	D	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5494	anri-ravinskis	ANRI RAVINSKIS	L	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5495	ben-king	BEN KING	C	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5497	brayden-hislop	BRAYDEN HISLOP	D	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5498	bryce-montgomery	BRYCE MONTGOMERY	D	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5499	chad-hillebrand	CHAD HILLEBRAND	L	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5500	chase-yoder	CHASE YODER	C	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5501	christoffer-sedoff	CHRISTOFFER SEDOFF	D	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5502	colin-felix	COLIN FELIX	D	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5503	connor-clattenburg	CONNOR CLATTENBURG	L	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5504	coulson-pitre	COULSON PITRE	R	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5505	david-gagnon	DAVID GAGNON	F	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5506	djibril-toure	DJIBRIL TOURE	D	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5507	elliot-desnoyers	ELLIOT DESNOYERS	L	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5508	eriks-mateiko	ERIKS MATEIKO	C	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5509	jackson-edward	JACKSON EDWARD	D	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5511	jacob-doty	JACOB DOTY	F	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5512	jaxon-nelson	JAXON NELSON	F	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5513	kalle-vaisanen	KALLE VAISANEN	F	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5516	mark-liwiski	MARK LIWISKI	F	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5518	noah-powell	NOAH POWELL	R	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5519	reece-newkirk	REECE NEWKIRK	F	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5520	riley-thompson	RILEY THOMPSON	C	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5521	sam-stange	SAM STANGE	F	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5522	tim-rego	TIM REGO	D	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5523	vitali-kravtsov	VITALI KRAVTSOV	R	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5525	zakary-karpa	ZAKARY KARPA	F	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5526	aidan-fulp	AIDAN FULP	D	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5527	alex-gallant	ALEX GALLANT	L	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5528	aram-minnetian	ARAM MINNETIAN	D	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5529	arnaud-durandeau	ARNAUD DURANDEAU	L	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5530	axel-sandin-pellikka	AXEL SANDIN-PELLIKKA	D	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5531	blake-biondi	BLAKE BIONDI	C	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5532	brady-stonehouse	BRADY STONEHOUSE	R	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5533	cade-webber	CADE WEBBER	D	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5535	carter-berger	CARTER BERGER	D	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5536	carter-wilkie	CARTER WILKIE	C	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5537	charle-edouard-d-astous	CHARLE-EDOUARD D'ASTOUS	D	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5538	chase-dafoe	CHASE DAFOE	F	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5539	cole-knuble	COLE KNUBLE	C	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5540	dylan-wendt	DYLAN WENDT	F	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5541	easton-cowan	EASTON COWAN	L	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5542	eddie-genborg	EDDIE GENBORG	F	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5543	ellis-rickwood	ELLIS RICKWOOD	F	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5545	gustav-stjernberg	GUSTAV STJERNBERG	D	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5546	harrison-israels	HARRISON ISRAELS	C	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5547	jack-anderson	JACK ANDERSON	D	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5549	jacob-truscott	JACOB TRUSCOTT	D	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5550	joe-dunlap	JOE DUNLAP	R	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5551	john-prokop	JOHN PROKOP	D	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
564	jonathan-aspirot	JONATHAN ASPIROT	D	314	8481219	45	\N	\N	\N	\N	\N	\N	\N	\N	\N
5554	josh-bloom	JOSH BLOOM	L	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5555	justin-nachbaur	JUSTIN NACHBAUR	R	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5556	kaleb-lawrence	KALEB LAWRENCE	C	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5557	kyler-kupka	KYLER KUPKA	C	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5558	landon-sim	LANDON SIM	F	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5559	lucas-wahlin	LUCAS WAHLIN	F	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5560	mason-geertsen	MASON GEERTSEN	L	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5561	matt-copponi	MATT COPPONI	C	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5562	matt-dimarsico	MATT DIMARSICO	L	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5564	max-wanner	MAX WANNER	D	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5565	milo-roelens	MILO ROELENS	C	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5566	nathan-bastian	NATHAN BASTIAN	R	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5567	niko-huuhtanen	NIKO HUUHTANEN	R	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5568	ole-julian-bj-rgvik-holm	OLE JULIAN BJøRGVIK-HOLM	D	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5569	patrick-thomas	PATRICK THOMAS	L	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5570	phip-waugh	PHIP WAUGH	D	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5571	reilly-webb	REILLY WEBB	D	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5572	riley-kidney	RILEY KIDNEY	C	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5573	riley-mckay	RILEY MCKAY	F	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5574	roger-mcqueen	ROGER MCQUEEN	C	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5575	roman-schmidt	ROMAN SCHMIDT	D	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5576	ryan-kirwan	RYAN KIRWAN	L	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5577	ryan-o-rourke	RYAN O'ROURKE	D	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5578	travis-dermott	TRAVIS DERMOTT	D	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5579	tyson-empey	TYSON EMPEY	L	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5580	artem-grushnikov	ARTEM GRUSHNIKOV	D	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5581	artur-cholach	ARTUR CHOLACH	D	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5471	jacob-perreault	JACOB PERREAULT	R	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5472	josh-jacobs	JOSH JACOBS	D	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5473	josiah-didier	JOSIAH DIDIER	D	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5475	kyle-burroughs	KYLE BURROUGHS	D	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
429	liam-ohgren	LIAM OHGREN	L	308	8483499	92	\N	\N	\N	\N	\N	\N	\N	\N	\N
5477	lucas-johansen	LUCAS JOHANSEN	D	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5589	dylan-james	DYLAN JAMES	L	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5590	ethan-frisch	ETHAN FRISCH	D	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5592	felix-trudeau	FELIX TRUDEAU	F	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5593	guillaume-brisebois	GUILLAUME BRISEBOIS	D	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5594	hank-kempf	HANK KEMPF	D	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5595	jackson-kunz	JACKSON KUNZ	C	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5596	jake-boltmann	JAKE BOLTMANN	D	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5598	jarod-crespo	JAROD CRESPO	D	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5599	jesse-kiiskinen	JESSE KIISKINEN	R	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5600	jiri-felcman	JIRI FELCMAN	F	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5601	justin-janicke	JUSTIN JANICKE	F	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5602	kaden-bohlsen	KADEN BOHLSEN	F	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5604	kyle-jackson	KYLE JACKSON	F	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5606	luke-kunin	LUKE KUNIN	C	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5607	matt-basgall	MATT BASGALL	D	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5608	max-grondin	MAX GRONDIN	C	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5610	michael-koster	MICHAEL KOSTER	D	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5611	navrin-mutter	NAVRIN MUTTER	L	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5612	nicky-leivermann	NICKY LEIVERMANN	D	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5613	noah-beck	NOAH BECK	D	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5614	nolan-moyle	NOLAN MOYLE	R	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5615	paul-ludwinski	PAUL LUDWINSKI	F	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5616	reilly-connors	REILLY CONNORS	C	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5617	riley-patterson	RILEY PATTERSON	C	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5618	robby-fabbri	ROBBY FABBRI	C	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5619	ryland-mosley	RYLAND MOSLEY	L	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5620	sheldon-rempal	SHELDON REMPAL	R	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5621	simon-mack	SIMON MACK	D	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5622	t-j-hughes	T.J. HUGHES	C	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5625	tyler-inamoto	TYLER INAMOTO	D	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5626	viggo-gustafsson	VIGGO GUSTAFSSON	D	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5627	vinzenz-rohrer	VINZENZ ROHRER	F	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5628	william-dufour	WILLIAM DUFOUR	L	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5630	yanick-turcotte	YANICK TURCOTTE	L	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5631	zac-funk	ZAC FUNK	L	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5632	zack-hayes	ZACK HAYES	D	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5633	aidan-hreschuk	AIDAN HRESCHUK	D	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5634	aiden-hansen-bukata	AIDEN HANSEN-BUKATA	D	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5635	alfons-freij	ALFONS FREIJ	D	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5636	austin-brimmer	AUSTIN BRIMMER	R	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5637	blake-montgomery	BLAKE MONTGOMERY	L	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5638	braden-birnie	BRADEN BIRNIE	L	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5639	brendan-smith	BRENDAN SMITH	D	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5640	cameron-butler	CAMERON BUTLER	R	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5641	carson-golder	CARSON GOLDER	R	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5642	case-mccarthy	CASE MCCARTHY	D	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5643	charlie-elick	CHARLIE ELICK	D	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5644	chase-wheatcroft	CHASE WHEATCROFT	F	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5645	chris-ortiz	CHRIS ORTIZ	D	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5647	christopher-douglas	CHRISTOPHER DOUGLAS	R	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5648	connor-mayer	CONNOR MAYER	D	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5649	david-kampf	DAVID KAMPF	F	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5650	david-lewandowski	DAVID LEWANDOWSKI	F	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5651	dawson-barteaux	DAWSON BARTEAUX	D	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5652	derek-daschke	DEREK DASCHKE	D	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5653	drew-callin	DREW CALLIN	F	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5654	drew-elliott	DREW ELLIOTT	L	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5655	hoyt-stanley	HOYT STANLEY	D	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5656	isak-walther	ISAK WALTHER	R	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5657	israel-mianscum	ISRAEL MIANSCUM	L	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5658	jack-berglund	JACK BERGLUND	C	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5659	jackson-berezowski	JACKSON BEREZOWSKI	C	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5660	jake-chiasson	JAKE CHIASSON	R	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5661	jakub-demek	JAKUB DEMEK	F	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5662	jayden-grubbe	JAYDEN GRUBBE	C	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5663	jordan-gustafson	JORDAN GUSTAFSON	F	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5664	josh-davies	JOSH DAVIES	L	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5665	josh-dunne	JOSH DUNNE	C	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5666	josh-lopina	JOSH LOPINA	C	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5667	josh-nadeau	JOSH NADEAU	F	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5669	konnor-smith	KONNOR SMITH	D	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5670	liam-valente	LIAM VALENTE	C	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5671	ludwig-persson	LUDWIG PERSSON	R	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5672	lukas-gustafsson	LUKAS GUSTAFSSON	D	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5673	marcel-marcel	MARCEL MARCEL	F	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9	mathieu-joseph	MATHIEU JOSEPH	F	319	8478472	21	\N	\N	\N	\N	\N	\N	\N	\N	\N
5675	matthew-brown	MATTHEW BROWN	F	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5676	matthew-savoie	MATTHEW SAVOIE	R	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5677	max-psenicka	MAX PSENICKA	D	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5678	maxim-strbak	MAXIM STRBAK	D	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5680	milan-lucic	MILAN LUCIC	L	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5681	miroslav-holinka	MIROSLAV HOLINKA	C	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5682	neil-shea	NEIL SHEA	F	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5683	noah-steen	NOAH STEEN	L	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5684	peter-tischke	PETER TISCHKE	D	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5686	reece-vitelli	REECE VITELLI	R	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5687	rhett-parsons	RHETT PARSONS	D	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5688	robby-drazner	ROBBY DRAZNER	D	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5689	ryan-chyzowski	RYAN CHYZOWSKI	C	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5690	ryan-hofer	RYAN HOFER	R	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5692	samuel-laberge	SAMUEL LABERGE	F	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5693	sawyer-boulton	SAWYER BOULTON	F	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5694	simon-pinard	SIMON PINARD	F	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5583	charlie-wright	CHARLIE WRIGHT	D	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5584	chris-harpur	CHRIS HARPUR	D	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5585	colin-ralph	COLIN RALPH	D	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5586	connor-punnett	CONNOR PUNNETT	D	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5587	cooper-gay	COOPER GAY	F	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5588	d-j-king	D.J. KING	D	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5705	andre-anania	ANDRE ANANIA	D	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5707	anthony-kehrer	ANTHONY KEHRER	D	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5708	anthony-romano	ANTHONY ROMANO	F	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5709	anton-lundmark	ANTON LUNDMARK	F	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5710	artem-guryev	ARTEM GURYEV	D	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5711	ben-dexheimer	BEN DEXHEIMER	D	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5712	ben-meehan	BEN MEEHAN	D	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5713	ben-strinden	BEN STRINDEN	R	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5714	ben-zloty	BEN ZLOTY	D	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5715	braden-doyle	BRADEN DOYLE	D	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5716	brandon-hawkins	BRANDON HAWKINS	R	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5717	brendan-gorman	BRENDAN GORMAN	F	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5719	caige-sterzer	CAIGE STERZER	F	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5720	chad-nychuk	CHAD NYCHUK	D	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5721	chase-pauls	CHASE PAULS	D	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5722	chongmin-lee	CHONGMIN LEE	F	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5723	christian-felton	CHRISTIAN FELTON	D	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5724	christian-fitzgerald	CHRISTIAN FITZGERALD	F	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5725	cole-krygier	COLE KRYGIER	D	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5726	colin-swoyer	COLIN SWOYER	D	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5727	curtis-douglas	CURTIS DOUGLAS	C	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5728	danny-katic	DANNY KATIC	L	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5729	darick-louis-jean	DARICK LOUIS-JEAN	D	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5730	davis-burnside	DAVIS BURNSIDE	F	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5731	deni-goure	DENI GOURE	C	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5732	dennis-cesana	DENNIS CESANA	D	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5733	dillan-bentley	DILLAN BENTLEY	F	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5734	dyllan-gill	DYLLAN GILL	D	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5736	emil-hemming	EMIL HEMMING	F	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5737	erik-bargholtz	ERIK BARGHOLTZ	F	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5738	ethan-czata	ETHAN CZATA	C	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5739	ethan-leyh	ETHAN LEYH	L	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5741	garrett-pyke	GARRETT PYKE	D	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5742	gavin-hain	GAVIN HAIN	C	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5743	hayes-hundley	HAYES HUNDLEY	D	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5744	henry-brzustewicz	HENRY BRZUSTEWICZ	D	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5745	herman-traff	HERMAN TRAFF	R	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5746	hunter-johannes	HUNTER JOHANNES	L	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5748	ilya-solovyov	ILYA SOLOVYOV	D	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5749	jack-bar	JACK BAR	D	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5750	jacob-dion	JACOB DION	D	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5751	jacob-hudson	JACOB HUDSON	F	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5752	jake-murray	JAKE MURRAY	D	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5753	james-stefan	JAMES STEFAN	R	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5754	jayden-lee	JAYDEN LEE	D	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5755	jett-jones	JETT JONES	F	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5756	john-gormley	JOHN GORMLEY	D	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5757	josh-eernisse	JOSH EERNISSE	R	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5758	kale-kessy	KALE KESSY	L	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5759	kent-anderson	KENT ANDERSON	D	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5760	kevin-wall	KEVIN WALL	R	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5761	kienan-draper	KIENAN DRAPER	R	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5762	kyle-walker	KYLE WALKER	D	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5764	loke-johansson	LOKE JOHANSSON	D	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5765	lucas-pettersson	LUCAS PETTERSSON	C	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5766	lukas-sillinger	LUKAS SILLINGER	L	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5767	luke-mistelbacher	LUKE MISTELBACHER	R	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5769	matthew-andonovski	MATTHEW ANDONOVSKI	D	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5770	matthew-sop	MATTHEW SOP	L	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5771	max-andreev	MAX ANDREEV	L	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5772	maxim-barbashev	MAXIM BARBASHEV	F	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5773	nathan-brown	NATHAN BROWN	C	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5774	owen-lindmark	OWEN LINDMARK	C	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5775	rieger-lorenz	RIEGER LORENZ	L	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5776	riley-mccourt	RILEY MCCOURT	D	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5777	romain-rodzinski	ROMAIN RODZINSKI	D	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5778	roman-kinal	ROMAN KINAL	D	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5779	ryan-bottrill	RYAN BOTTRILL	F	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5780	ryan-mccleary	RYAN MCCLEARY	D	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5781	ryan-mcguire	RYAN MCGUIRE	F	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5782	ryan-tattle	RYAN TATTLE	F	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5783	sam-sedley	SAM SEDLEY	D	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5784	sam-stevens	SAM STEVENS	C	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5785	samuel-mayer	SAMUEL MAYER	D	306	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5787	sullivan-mack	SULLIVAN MACK	F	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5788	tag-bertuzzi	TAG BERTUZZI	F	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5789	tarun-fizer	TARUN FIZER	R	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5790	terrell-goldsmith	TERRELL GOLDSMITH	D	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5791	thomas-messineo	THOMAS MESSINEO	D	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5792	tristan-sarsland	TRISTAN SARSLAND	D	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5793	troy-murray	TROY MURRAY	F	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5794	tyler-weiss	TYLER WEISS	L	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5795	valtteri-piironen	VALTTERI PIIRONEN	D	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5796	vincent-sevigny	VINCENT SEVIGNY	D	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5797	will-mackinnon	WILL MACKINNON	D	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5798	will-riedell	WILL RIEDELL	D	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5799	xavier-bernard	XAVIER BERNARD	D	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5800	zach-berzolla	ZACH BERZOLLA	D	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5801	zach-okabe	ZACH OKABE	C	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
454	tanner-laczynski	TANNER LACZYNSKI	F	306	8479550	28	\N	\N	\N	\N	\N	\N	\N	\N	\N
4873	jordan-oesterle	JORDAN OESTERLE	D	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4881	sheldon-dries	SHELDON DRIES	C	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4905	tristan-luneau	TRISTAN LUNEAU	D	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5695	travis-howe	TRAVIS HOWE	R	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5697	tyson-feist	TYSON FEIST	D	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5700	william-nicholl	WILLIAM NICHOLL	C	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5701	wyatte-wylie	WYATTE WYLIE	D	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5703	aiden-dubinsky	AIDEN DUBINSKY	D	309	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5704	alex-gaffney	ALEX GAFFNEY	L	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5691	saige-weinstein	SAIGE WEINSTEIN	D	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5696	tyler-motte	TYLER MOTTE	L	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4955	kasper-halttunen	KASPER HALTTUNEN	F	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5699	vinny-borgesi	VINNY BORGESI	D	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4981	david-gustafsson	DAVID GUSTAFSSON	C	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4994	henrik-rybinski	HENRIK RYBINSKI	C	307	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5002	victor-soderstrom	VICTOR SODERSTROM	D	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5718	brooklyn-kalmikov	BROOKLYN KALMIKOV	L	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5029	jamie-engelbert	JAMIE ENGELBERT	F	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5054	gavin-bayreuther	GAVIN BAYREUTHER	D	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5075	bryce-mcconnell-barker	BRYCE MCCONNELL-BARKER	F	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5101	kevin-rooney	KEVIN ROONEY	C	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5112	brett-chorske	BRETT CHORSKE	F	299	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5126	stian-solberg	STIAN SOLBERG	D	317	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5145	brett-harrison	BRETT HARRISON	R	310	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5163	jonathan-lekkerimaki	JONATHAN LEKKERIMAKI	R	295	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5193	daniel-d-amato	DANIEL D'AMATO	L	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5217	keean-washkurak	KEEAN WASHKURAK	C	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5234	luca-marrelli	LUCA MARRELLI	D	301	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5740	frank-djurasevic	FRANK DJURASEVIC	D	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5236	luke-toporowski	LUKE TOPOROWSKI	R	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5255	mattias-havelid	MATTIAS HAVELID	D	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5763	landon-mccallum	LANDON MCCALLUM	F	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5280	andreas-englund	ANDREAS ENGLUND	D	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5786	stevie-leskovar	STEVIE LESKOVAR	D	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5304	jacob-macdonald	JACOB MACDONALD	D	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5331	landen-hookey	LANDEN HOOKEY	C	297	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5373	connor-mylymok	CONNOR MYLYMOK	L	316	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5391	charles-alexis-legault	CHARLES ALEXIS LEGAULT	D	300	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5419	etienne-morin	ETIENNE MORIN	D	298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5439	cooper-flinton	COOPER FLINTON	L	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5459	spencer-kersten	SPENCER KERSTEN	R	320	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
323	dalibor-dvorsky	DALIBOR DVORSKY	F	319	8484164	54	\N	\N	\N	\N	\N	\N	\N	\N	\N
5474	kevin-connauton	KEVIN CONNAUTON	D	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5496	brandon-baddock	BRANDON BADDOCK	L	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5510	jackson-van-de-leest	JACKSON VAN DE LEEST	D	324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
741	kyle-capobianco	KYLE CAPOBIANCO	D	321	8478476	20	\N	\N	\N	\N	\N	\N	\N	\N	\N
5265	carey-terrance	CAREY TERRANCE	F	305	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5544	fabian-wagner	FABIAN WAGNER	L	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5563	matthew-stienburg	MATTHEW STIENBURG	F	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5582	brandon-holt	BRANDON HOLT	D	323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5378	jake-furlong	JAKE FURLONG	D	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5603	kevin-conley	KEVIN CONLEY	C	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5624	tommy-lafreniere	TOMMY LAFRENIERE	R	296	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5646	christopher-brown	CHRISTOPHER BROWN	R	314	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
578	riley-fiddler-schultz	RILEY FIDDLER-SCHULTZ	L	315	8483090	45	\N	\N	\N	\N	\N	\N	\N	\N	\N
5668	keaton-mastrodonato	KEATON MASTRODONATO	F	313	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9946	ville-koivunen	VILLE KOIVUNEN	L	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9951	matthew-highmore	MATTHEW HIGHMORE	C	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9953	rafael-harvey-pinard	RAFAEL HARVEY-PINARD	L	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9954	avery-hayes	AVERY HAYES	R	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9989	gabe-klassen	GABE KLASSEN	C	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10016	rutger-mcgroarty	RUTGER MCGROARTY	L	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10024	matthew-maggio	MATTHEW MAGGIO	F	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10032	marshall-warren	MARSHALL WARREN	D	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10062	cole-mcward	COLE MCWARD	D	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10069	joey-larson	JOEY LARSON	F	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10078	alex-jefferies	ALEX JEFFERIES	F	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10085	owen-pickering	OWEN PICKERING	D	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10091	ethan-bear	ETHAN BEAR	D	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10115	joona-koppanen	JOONA KOPPANEN	C	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10131	daylan-kuefler	DAYLAN KUEFLER	F	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10174	hunter-drew	HUNTER DREW	R	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10203	chris-terry	CHRIS TERRY	F	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10204	finn-harding	FINN HARDING	D	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10221	cam-berg	CAM BERG	F	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10226	matt-dumba	MATT DUMBA	D	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10259	isaiah-george	ISAIAH GEORGE	D	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10273	cam-thiesing	CAM THIESING	F	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10289	sean-day	SEAN DAY	D	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10290	aaron-huglen	AARON HUGLEN	R	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10296	chase-pietila	CHASE PIETILA	D	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10306	tanner-howe	TANNER HOWE	L	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10341	pierrick-dube	PIERRICK DUBE	R	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10349	alex-alexeyev	ALEX ALEXEYEV	D	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10380	luke-rowe	LUKE ROWE	D	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10420	bokondji-imama	BOKONDJI IMAMA	L	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10426	eetu-liukas	EETU LIUKAS	F	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10440	phil-kemp	PHIL KEMP	D	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10444	victor-eklund	VICTOR EKLUND	F	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10450	cole-eiserman	COLE EISERMAN	F	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10469	c-j-smith	C.J. SMITH	F	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
12682	melvin-fernstrom	MELVIN FERNSTROM	R	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10501	harrison-brunicke	HARRISON BRUNICKE	D	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10513	ryan-mcallister	RYAN MCALLISTER	F	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10529	jack-st-ivany	JACK ST. IVANY	D	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10538	nolan-renwick	NOLAN RENWICK	R	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10540	raivis-ansons	RAIVIS ANSONS	L	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10576	zach-gallant	ZACH GALLANT	R	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10591	david-breazeale	DAVID BREAZEALE	D	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10596	gleb-veremyev	GLEB VEREMYEV	F	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10623	calle-odelius	CALLE ODELIUS	D	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10624	calum-ritchie	CALUM RITCHIE	C	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10631	daniel-laatsch	DANIEL LAATSCH	D	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10636	emil-pieniniemi	EMIL PIENINIEMI	D	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10675	brandon-buhr	BRANDON BUHR	F	322	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10683	daniel-russell	DANIEL RUSSELL	F	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10685	egor-zamula	EGOR ZAMULA	D	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10696	jesse-pulkkinen	JESSE PULKKINEN	D	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10704	mathieu-de-st-phalle	MATHIEU DE ST. PHALLE	R	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10706	max-dorrington	MAX DORRINGTON	F	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10710	mikhail-ilyin	MIKHAIL ILYIN	F	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10720	scooter-brickey	SCOOTER BRICKEY	D	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10737	andrej-sustr	ANDREJ SUSTR	D	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10757	dylan-moulton	DYLAN MOULTON	D	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10758	filip-hallander	FILIP HALLANDER	L	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10764	jackson-jutting	JACKSON JUTTING	F	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10773	kaleb-pearson	KALEB PEARSON	F	321	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10789	nick-leddy	NICK LEDDY	D	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10809	zach-urdahl	ZACH URDAHL	F	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
11922	braidan-simmons-fischer	BRAIDAN SIMMONS-FISCHER	D	308	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10825	brayden-edwards	BRAYDEN EDWARDS	F	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10827	brent-johnson	BRENT JOHNSON	D	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10829	broten-sabo	BROTEN SABO	D	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10831	caleb-jones	CALEB JONES	D	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10835	chris-hedden	CHRIS HEDDEN	D	303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10841	daniil-prokhorov	DANIIL PROKHOROV	F	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10858	gavin-mccarthy	GAVIN MCCARTHY	D	315	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10879	lachlan-getz	LACHLAN GETZ	D	319	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10885	mack-oliphant	MACK OLIPHANT	D	318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10887	mason-mccormick	MASON MCCORMICK	C	312	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10891	max-graham	MAX GRAHAM	F	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10894	nick-andrews	NICK ANDREWS	D	304	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10896	quinn-beauchesne	QUINN BEAUCHESNE	D	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10904	ryan-miller	RYAN MILLER	F	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10909	scott-reedy	SCOTT REEDY	F	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10910	sean-larochelle	SEAN LAROCHELLE	D	311	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10917	tommy-budnick	TOMMY BUDNICK	D	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9883	adam-beckman	ADAM BECKMAN	L	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9911	liam-foudy	LIAM FOUDY	F	326	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9920	aidan-mcdonough	AIDAN MCDONOUGH	L	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9926	tristan-broz	TRISTAN BROZ	F	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9981	atley-calvert	ATLEY CALVERT	C	325	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10848	drake-burgin	DRAKE BURGIN	D	302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
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

\unrestrict GL5E7ahivl4Oy3ZthPVRHhL2bJGgDoJkw02cPqjUa0QkvFVbYswOiJTqXkBmHVs

