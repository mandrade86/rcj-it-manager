# Importar tickets de desarrollo desde eTicket

eTicket marca tickets y expone un API. **IT-RCJ-Manager** (este repo) importa los marcados como **servicios**.

```text
Agente marca en eTicket
  → itManagerExport.marked + importStatus=pending
Portal (poll o botón) GET .../services?status=pending
  → upsert por externalId
  → POST .../services/{id}/imported { remoteServiceId, importedBy }
```

## Variables en `.env` del portal

```env
# URL del API Gateway de eTicket (NO el frontend https://eticket.rcjcorporacion.com ni .../api)
ETICKET_API_BASE_URL=https://nitnbof6w9.execute-api.us-east-1.amazonaws.com/prod
# Misma clave que IT_MANAGER_API_KEY en eTicket
ETICKET_API_KEY=genera-una-clave-larga

# Opcional: sync automático
ETICKET_SYNC_CRON=false
ETICKET_SYNC_INTERVAL_MINUTES=15
```

Deben estar en el `.env` del **servidor** (`D:\rcj-it-manager\.env`), no solo en tu PC.
Tras cambiar: `Restart-Service RCJITManager`.

## Permiso

`eticket:servicios:ver` — ver listado y sincronizar.  
Los roles con `*` (admin) ya pasan. Asígnarlo a jefatura IT / PMO en **Admin → Roles**.

## UI

**IT Técnico → Servicios eTicket** (`/it/eticket-servicios`)

- Lista lo importado en Mongo (`ServicioEticket`)
- **Sincronizar ahora** → GET pending + upsert + ACK
- Columna **Proyecto**: asignar / quitar vínculo a un proyecto del Plan IT (se conserva al re-sincronizar)

## API del portal (JWT)

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/eticket/servicios/status` | ¿Hay URL/key? |
| GET | `/api/eticket/servicios?q=&proyecto_id=&sin_proyecto=1` | Listado local |
| GET | `/api/eticket/servicios/:id` | Detalle (_id, externalId o ticketNumber) |
| PATCH | `/api/eticket/servicios/:id/proyecto` | Body `{ "proyecto_id": "INV-001" }` o `null` |
| POST | `/api/eticket/servicios/sync` | Importar pendientes desde eTicket |

## Contrato eTicket (referencia)

Auth: `X-API-Key` o `Authorization: Bearer <key>`

- `GET /integrations/it-manager/services?status=pending`
- `GET /integrations/it-manager/services/{id}`
- `POST /integrations/it-manager/services/{id}/imported`  
  body: `{ "remoteServiceId": "<_id Mongo portal>", "importedBy": "it-rcj-manager" }`  
  `409` = ya importado (no duplicar)

Cada ítem usa `externalId` (id Mongo del ticket) como clave única en el portal.

## Verificación

1. En eTicket: marcar un ticket de desarrollo → badge pendiente  
2. En portal: Sincronizar → aparece en la tabla  
3. En eTicket: badge Importado; GET pending ya no lo incluye  
4. Sin `ETICKET_API_KEY` → sync responde 503; eTicket sin key → 401  
