// db/setup.js — Creates all tables and seeds default data
// Run once: node db/setup.js
require("dotenv").config();
const { pool } = require("./database");
const bcrypt = require("bcryptjs");

async function setup() {
  const client = await pool.connect();
  try {
    console.log("🔧 Setting up database...\n");

    // ── CREATE TABLES ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        username    VARCHAR(50)  UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,
        name        VARCHAR(100) NOT NULL,
        rank        VARCHAR(50)  NOT NULL,
        role        VARCHAR(10)  NOT NULL CHECK (role IN ('SHO','IO','DSP')),
        active      BOOLEAN      NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✅ Table: users");

    await client.query(`
      CREATE TABLE IF NOT EXISTS cases (
        id                  SERIAL PRIMARY KEY,
        fir_no              VARCHAR(50)  UNIQUE NOT NULL,
        year                INTEGER,
        fir_date            DATE,
        section_of_law      TEXT,
        category            VARCHAR(100),
        subtype             VARCHAR(100),
        io_name             VARCHAR(100),
        accused_name        TEXT,
        num_accused         INTEGER DEFAULT 0,
        victim_name         TEXT,
        rough_sketch        VARCHAR(10),
        obs_mahazar         VARCHAR(10),
        witness_smt         VARCHAR(10),
        cd1_complete        VARCHAR(10),
        arrest_made         VARCHAR(10),
        num_arrests         INTEGER DEFAULT 0,
        remand_report       VARCHAR(20),
        absconding_accused  VARCHAR(20),
        fir_sent_court      DATE,
        wound_cert_received VARCHAR(10),
        wound_cert_no       VARCHAR(50),
        viscera_sent_court  VARCHAR(10),
        pmc_received        VARCHAR(10),
        vehicle_sent_mv     VARCHAR(10),
        mv_report_received  VARCHAR(10),
        fsl_obtained        VARCHAR(10),
        wc_due              DATE,
        mv_due              DATE,
        cs_due              DATE,
        cs_filed_date       DATE,
        current_stage       VARCHAR(100),
        next_action         VARCHAR(100),
        final_disposal      VARCHAR(100),
        remarks             TEXT,
        created_by          INTEGER REFERENCES users(id),
        updated_by          INTEGER REFERENCES users(id),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✅ Table: cases");

    await client.query(`
      CREATE TABLE IF NOT EXISTS accused (
        id            SERIAL PRIMARY KEY,
        fir_no        VARCHAR(50) REFERENCES cases(fir_no) ON DELETE CASCADE,
        accused_name  VARCHAR(100) NOT NULL,
        age           INTEGER,
        gender        VARCHAR(20),
        address       TEXT,
        alias         VARCHAR(100),
        status        VARCHAR(50),
        arrest_date   DATE,
        arrested_by   VARCHAR(100),
        remand_date   DATE,
        court_name    VARCHAR(100),
        bail_status   VARCHAR(50),
        nbw_issued    VARCHAR(10) DEFAULT 'No',
        remarks       TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✅ Table: accused");

    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id              SERIAL PRIMARY KEY,
        fir_no          VARCHAR(50),
        case_type       VARCHAR(50),
        veh_type        VARCHAR(50),
        make_model      VARCHAR(100),
        reg_no          VARCHAR(30),
        owner_name      VARCHAR(100),
        owner_address   TEXT,
        date_seized     DATE,
        place_stored    VARCHAR(100),
        court_prop_no   VARCHAR(50),
        status          VARCHAR(50) DEFAULT 'In Custody',
        disposal_stage  VARCHAR(50) DEFAULT 'In Custody',
        disposal_date   DATE,
        remarks         TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✅ Table: vehicles");

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id),
        username    VARCHAR(50),
        action      VARCHAR(50),
        table_name  VARCHAR(50),
        record_id   INTEGER,
        details     TEXT,
        ip          VARCHAR(50),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✅ Table: audit_log\n");

    // ── INDEXES for performance ─────────────────────────────────────
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cases_fir_no   ON cases(fir_no);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cases_io_name  ON cases(io_name);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cases_category ON cases(category);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cases_year     ON cases(year);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_accused_fir_no ON accused(fir_no);`);
    console.log("✅ Indexes created\n");

    // ── SEED DEFAULT USERS ──────────────────────────────────────────
    const existing = await client.query("SELECT COUNT(*) FROM users");
    if (parseInt(existing.rows[0].count) === 0) {
      console.log("🌱 Seeding default users...");
      const defaultUsers = [
        { username:"sho_admin",  password:"sho123",  name:"Inspector K. Suresh", rank:"Inspector", role:"SHO" },
        { username:"si_rajan",   password:"io123",   name:"SI Rajan",             rank:"SI",        role:"IO"  },
        { username:"asi_kumar",  password:"io123",   name:"ASI Kumar",            rank:"ASI",       role:"IO"  },
        { username:"hc_senthil", password:"io123",   name:"HC Senthil",           rank:"HC",        role:"IO"  },
        { username:"si_meena",   password:"io123",   name:"SI Meena",             rank:"SI",        role:"IO"  },
        { username:"hc_balu",    password:"io123",   name:"HC Balu",              rank:"HC",        role:"IO"  },
        { username:"dsp_view",   password:"dsp123",  name:"DSP R. Krishnan",      rank:"DSP",       role:"DSP" },
      ];
      for (const u of defaultUsers) {
        const hash = await bcrypt.hash(u.password, 12);
        await client.query(
          `INSERT INTO users (username,password,name,rank,role)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (username) DO NOTHING`,
          [u.username, hash, u.name, u.rank, u.role]
        );
        console.log(`   ✓ ${u.username} (${u.role})`);
      }

      // ── SEED SAMPLE CASES ─────────────────────────────────────────
      console.log("\n🌱 Seeding sample cases...");
      const sampleCases = [
        { fir_no:"101/2025", year:2025, fir_date:"2025-03-10", section_of_law:"303(2) BNS", category:"Bodily Offences", subtype:"Murder", io_name:"SI Rajan", accused_name:"Ravi Kumar", num_accused:2, victim_name:"Murugan", rough_sketch:"Yes", obs_mahazar:"Yes", witness_smt:"Yes", cd1_complete:"Yes", arrest_made:"Yes", num_arrests:1, remand_report:"Yes", absconding_accused:"1", fir_sent_court:"2025-03-22", wound_cert_received:"No", viscera_sent_court:"Yes", pmc_received:"No", vehicle_sent_mv:"No", mv_report_received:"No", fsl_obtained:"No", wc_due:"2025-04-09", mv_due:"2025-04-09", cs_due:"2025-06-08", current_stage:"Accused Absconding", next_action:"Arrest accused", final_disposal:"Under Investigation", remarks:"1 accused absconding" },
        { fir_no:"215/2025", year:2025, fir_date:"2025-07-05", section_of_law:"281,106 BNS", category:"Accident", subtype:"Fatal", io_name:"ASI Kumar", accused_name:"Shankar D", num_accused:1, victim_name:"Selvi", rough_sketch:"Yes", obs_mahazar:"Yes", witness_smt:"Yes", cd1_complete:"Yes", arrest_made:"Yes", num_arrests:1, remand_report:"Yes", absconding_accused:"Nil", fir_sent_court:"2025-07-18", wound_cert_received:"N/A", viscera_sent_court:"Yes", pmc_received:"Yes", vehicle_sent_mv:"Yes", mv_report_received:"Yes", fsl_obtained:"Yes", wc_due:"2025-08-04", mv_due:"2025-08-04", cs_due:"2025-10-03", cs_filed_date:"2025-08-20", current_stage:"Charge Sheet Filed", next_action:"Court hearing", final_disposal:"Chargesheeted", remarks:"" },
        { fir_no:"318/2025", year:2025, fir_date:"2025-09-20", section_of_law:"379 BNS", category:"Property Crime Offences", subtype:"Theft (Non GCR)", io_name:"HC Senthil", accused_name:"Unknown", num_accused:0, victim_name:"Anbu", rough_sketch:"Yes", obs_mahazar:"Yes", witness_smt:"No", cd1_complete:"No", arrest_made:"No", num_arrests:0, remand_report:"N/A", absconding_accused:"N/A", wound_cert_received:"N/A", viscera_sent_court:"N/A", pmc_received:"N/A", vehicle_sent_mv:"N/A", mv_report_received:"N/A", fsl_obtained:"No", wc_due:"2025-10-20", mv_due:"2025-10-20", cs_due:"2025-11-19", current_stage:"CCTV Collection Pending", next_action:"Collect CCTV footage", final_disposal:"Under Investigation", remarks:"Accused not traced" },
        { fir_no:"422/2025", year:2025, fir_date:"2025-11-01", section_of_law:"POCSO Act", category:"Crime against Women and Children", subtype:"POCSO", io_name:"SI Meena", accused_name:"Pandi R", num_accused:1, victim_name:"Minor Girl", rough_sketch:"Yes", obs_mahazar:"Yes", witness_smt:"Yes", cd1_complete:"Yes", arrest_made:"Yes", num_arrests:1, remand_report:"Yes", absconding_accused:"Nil", fir_sent_court:"2025-11-10", wound_cert_received:"N/A", viscera_sent_court:"No", pmc_received:"N/A", vehicle_sent_mv:"N/A", mv_report_received:"N/A", fsl_obtained:"No", wc_due:"2025-12-01", mv_due:"2025-12-01", cs_due:"2026-01-30", current_stage:"FSL Pending", next_action:"Obtain FSL Report", final_disposal:"Under Investigation", remarks:"FSL awaited" },
        { fir_no:"89/2026", year:2026, fir_date:"2026-02-15", section_of_law:"281,125(a) BNS", category:"Accident", subtype:"Non Fatal", io_name:"HC Senthil", accused_name:"Vijay S", num_accused:1, victim_name:"Saravanan", rough_sketch:"Yes", obs_mahazar:"Yes", witness_smt:"Yes", cd1_complete:"Yes", arrest_made:"Yes", num_arrests:1, remand_report:"Yes", absconding_accused:"Nil", fir_sent_court:"2026-02-28", wound_cert_received:"No", viscera_sent_court:"No", pmc_received:"N/A", vehicle_sent_mv:"Yes", mv_report_received:"No", fsl_obtained:"No", wc_due:"2026-03-17", mv_due:"2026-03-17", cs_due:"2026-04-16", current_stage:"Wound certificate pending", next_action:"Obtain Wound Certificate", final_disposal:"Under Investigation", remarks:"Wound cert pending" },
      ];

      for (const c of sampleCases) {
        await client.query(
          `INSERT INTO cases (fir_no,year,fir_date,section_of_law,category,subtype,io_name,
            accused_name,num_accused,victim_name,rough_sketch,obs_mahazar,witness_smt,
            cd1_complete,arrest_made,num_arrests,remand_report,absconding_accused,
            fir_sent_court,wound_cert_received,viscera_sent_court,pmc_received,
            vehicle_sent_mv,mv_report_received,fsl_obtained,wc_due,mv_due,cs_due,
            cs_filed_date,current_stage,next_action,final_disposal,remarks)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
                   $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)
           ON CONFLICT (fir_no) DO NOTHING`,
          [c.fir_no,c.year,c.fir_date,c.section_of_law,c.category,c.subtype,c.io_name,
           c.accused_name,c.num_accused,c.victim_name,c.rough_sketch,c.obs_mahazar,c.witness_smt,
           c.cd1_complete,c.arrest_made,c.num_arrests,c.remand_report,c.absconding_accused,
           c.fir_sent_court||null,c.wound_cert_received,c.viscera_sent_court,c.pmc_received,
           c.vehicle_sent_mv,c.mv_report_received,c.fsl_obtained,c.wc_due,c.mv_due,c.cs_due,
           c.cs_filed_date||null,c.current_stage,c.next_action,c.final_disposal,c.remarks]
        );
        console.log(`   ✓ Case: ${c.fir_no}`);
      }

      // ── SEED SAMPLE ACCUSED ───────────────────────────────────────
      await client.query(`
        INSERT INTO accused (fir_no,accused_name,age,gender,address,alias,status,arrest_date,arrested_by,remand_date,court_name,bail_status,nbw_issued)
        VALUES ('101/2025','Ravi Kumar',28,'Male','12 Main St, Chennai','Ravi','Arrested','2025-03-14','SI Rajan','2025-03-15','District Court','Bail Rejected','No')
        ON CONFLICT DO NOTHING
      `);
      await client.query(`
        INSERT INTO accused (fir_no,accused_name,age,gender,address,status,bail_status,nbw_issued,remarks)
        VALUES ('101/2025','Suresh P',32,'Male','45 Anna Nagar','Absconding','Bail Not Applied','Yes','Absconding since FIR')
        ON CONFLICT DO NOTHING
      `);
      await client.query(`
        INSERT INTO accused (fir_no,accused_name,age,gender,address,status,arrest_date,arrested_by,remand_date,court_name,bail_status,nbw_issued)
        VALUES ('215/2025','Shankar D',45,'Male','8 GST Road, Kanchipuram','Arrested','2025-07-06','ASI Kumar','2025-07-07','JMFC','Bail Granted','No')
        ON CONFLICT DO NOTHING
      `);

      // ── SEED SAMPLE VEHICLES ──────────────────────────────────────
      await client.query(`
        INSERT INTO vehicles (fir_no,case_type,veh_type,reg_no,owner_name,owner_address,date_seized,place_stored,status,disposal_stage,disposal_date)
        VALUES ('94/26','CP(fatal)','Truck','TN 21 BW 1467','SILAMBARASAN','No:2 2nd Quarter St','2026-04-15','Station Yard','Released','Released after MV','2026-05-03')
        ON CONFLICT DO NOTHING
      `);
      await client.query(`
        INSERT INTO vehicles (fir_no,case_type,veh_type,make_model,reg_no,owner_name,owner_address,date_seized,place_stored,status,disposal_stage)
        VALUES ('124/26','CP(non fatal)','Truck','Container lorry','TN 03 AE 8719','Kanmani S/o Mayandi','4th Cross St','2026-05-01','Station Yard','In Custody','In Custody')
        ON CONFLICT DO NOTHING
      `);

      console.log("\n✅ All seed data inserted");
    } else {
      console.log("ℹ️  Database already has data — skipping seed");
    }

    console.log("\n🎉 Database setup complete!");
    console.log("You can now start the server with: node server.js\n");

  } catch (err) {
    console.error("❌ Setup error:", err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

setup().catch(console.error);
