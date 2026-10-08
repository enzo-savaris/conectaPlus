require('dotenv').config({path:'.env'});
const m=require('mysql2/promise');const fs=require('fs');
(async()=>{const c=await m.createConnection({host:process.env.DB_HOST,port:process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,multipleStatements:true});
const [r]=await c.query('SELECT COUNT(*) n, SUM(LINKCURSO IS NOT NULL OR ARQUIVOCURSO IS NOT NULL) c FROM TBLCDSCURSO0');console.log('cursos',r[0]);
if(process.argv[2]==='run'){for(const f of ['cursos-modulos','cursos-capitulos-material']){await c.query(fs.readFileSync('sql/'+f+'.sql','utf8'));console.log('ok',f)}}
await c.end()})().catch(e=>console.log('ERR',e.message))
