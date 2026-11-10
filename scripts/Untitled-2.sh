# Desde tu PC o desde el servidor nuevo (ajusta IPs/usuario)
scp administraador@172.16.150.20:/opt/rcj-it-manager/data/backups/rcj_it_manager-*.archive .
scp -r administraador@172.16.150.20:/opt/rcj-it-manager/data/certificados .
scp -r administraador@172.16.150.20:/opt/rcj-it-manager/data/adjuntos-tareas .
# si usan gastos.xlsx:
scp administraador@172.16.150.20:/opt/rcj-it-manager/data/gastos.xlsx .