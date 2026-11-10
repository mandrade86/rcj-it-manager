.\scripts\mongo-import-local.ps1 data\backups\rcj_it_manager-20261026-115632.archive `
  -Uri "mongodb:///appUser:FAJ378PAR7615@172.16.146.20:27017:27017" `
  -Db rcj_it_manager `
  -Drop



.\scripts\mongo-import-local.ps1 data\backups\rcj_it_manager-20261026-115632.archive `
  -Uri "mongodb://appUser:FAJ378PAR7615@172.16.146.20:27017"`
  -Database rcj_it_manager `
  -Drop




  mongodb://appUser:FAJ378PAR7615@172.16.146.20:27017/?directConnection=true&serverSelectionTimeoutMS=2000&authSource=admin&appName=mongosh+2.13.0&tls=false