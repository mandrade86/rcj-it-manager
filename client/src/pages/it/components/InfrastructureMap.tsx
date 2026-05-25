import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Diagrama de referencia: integración SAP B1 Cloud (HANA), Active Directory y portales RCJ.
 * Sin dependencia de AWS — alineado al catálogo de sistemas en Arquitectura IT.
 */
export function InfrastructureMap() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Arquitectura de integración (referencia)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Identidad en Active Directory, ERP en SAP B1 sobre HANA en la nube, y portales internos
          conectados vía capa de integración RCJ (Service Layer + SSO).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <svg
          viewBox="0 0 760 480"
          className="w-full max-w-5xl text-[var(--navy)]"
          role="img"
          aria-label="Diagrama SAP Cloud, Active Directory e integración entre sistemas"
        >
          <defs>
            <linearGradient id="sapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#008FD3" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#008FD3" stopOpacity="0.28" />
            </linearGradient>
            <linearGradient id="adGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#002060" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#002060" stopOpacity="0.2" />
            </linearGradient>
            <marker id="arrowGreen" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#70AD47" />
            </marker>
            <marker id="arrowNavy" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#002060" />
            </marker>
          </defs>

          {/* Edge */}
          <rect x="10" y="8" width="740" height="44" rx="6" fill="#DCE6F1" stroke="#002060" strokeWidth="1.5" />
          <text x="380" y="35" textAnchor="middle" fontSize="12" fontWeight="600">
            Perímetro — Fortinet · VPN · acceso remoto corporativo
          </text>

          {/* Active Directory */}
          <rect x="20" y="68" width="220" height="130" rx="6" fill="url(#adGrad)" stroke="#002060" strokeWidth="1.5" />
          <text x="130" y="92" textAnchor="middle" fontSize="12" fontWeight="600">
            Active Directory
          </text>
          <text x="130" y="110" textAnchor="middle" fontSize="10">
            AD DS on-prem · GPO · DNS
          </text>
          <text x="130" y="128" textAnchor="middle" fontSize="9" fill="#6B7280">
            (opcional) Entra Connect → M365
          </text>
          <rect x="40" y="142" width="80" height="40" rx="4" fill="#fff" stroke="#E0E4E8" />
          <text x="80" y="167" textAnchor="middle" fontSize="9">
            Usuarios
          </text>
          <rect x="140" y="142" width="80" height="40" rx="4" fill="#fff" stroke="#E0E4E8" />
          <text x="180" y="167" textAnchor="middle" fontSize="9">
            SSO / LDAP
          </text>

          {/* SAP Cloud */}
          <rect x="270" y="68" width="220" height="130" rx="6" fill="url(#sapGrad)" stroke="#008FD3" strokeWidth="1.5" />
          <text x="380" y="92" textAnchor="middle" fontSize="12" fontWeight="600">
            SAP B1 Cloud (HANA)
          </text>
          <text x="380" y="110" textAnchor="middle" fontSize="10">
            ERP financiero · maestros
          </text>
          <rect x="290" y="122" width="180" height="36" rx="4" fill="#fff" stroke="#008FD3" strokeWidth="1" />
          <text x="380" y="145" textAnchor="middle" fontSize="9" fontWeight="600">
            Service Layer (REST/OData)
          </text>
          <text x="380" y="178" textAnchor="middle" fontSize="8" fill="#6B7280">
            Usuario técnico de integración
          </text>

          {/* On-prem complement */}
          <rect x="520" y="68" width="220" height="130" rx="6" fill="#F1F3F5" stroke="#6B7280" strokeWidth="1.5" />
          <text x="630" y="92" textAnchor="middle" fontSize="12" fontWeight="600">
            On-premise RCJ
          </text>
          <text x="630" y="110" textAnchor="middle" fontSize="10">
            SQL Server · IIS legacy
          </text>
          <rect x="540" y="122" width="85" height="40" rx="4" fill="#fff" stroke="#E0E4E8" />
          <text x="582" y="147" textAnchor="middle" fontSize="9">
            SQL apps
          </text>
          <rect x="635" y="122" width="85" height="40" rx="4" fill="#fff" stroke="#E0E4E8" />
          <text x="677" y="147" textAnchor="middle" fontSize="9">
            IIS
          </text>

          {/* Integration layer */}
          <rect x="120" y="220" width="520" height="72" rx="6" fill="#EAF5D9" stroke="#70AD47" strokeWidth="2" />
          <text x="380" y="248" textAnchor="middle" fontSize="12" fontWeight="600">
            Capa de integración RCJ (API / BFF)
          </text>
          <text x="380" y="268" textAnchor="middle" fontSize="10">
            Auth AD · JWT · proxy SAP · logs · reintentos
          </text>

          {/* Arrows AD → Integration */}
          <line x1="130" y1="198" x2="200" y2="220" stroke="#002060" strokeWidth="1.5" markerEnd="url(#arrowNavy)" />
          {/* SAP → Integration */}
          <line x1="380" y1="198" x2="380" y2="218" stroke="#008FD3" strokeWidth="1.5" markerEnd="url(#arrowNavy)" />
          {/* On-prem → Integration */}
          <line x1="630" y1="198" x2="560" y2="220" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowNavy)" />

          {/* Apps */}
          <rect x="40" y="310" width="680" height="155" rx="6" fill="#fff" stroke="#70AD47" strokeWidth="1.5" />
          <text x="380" y="332" textAnchor="middle" fontSize="12" fontWeight="600">
            Portales y sistemas internos
          </text>
          {[
            { label: 'eTickets', sub: 'NestJS' },
            { label: 'eProc', sub: 'Node' },
            { label: 'eLab', sub: 'MongoDB' },
            { label: 'eCash', sub: 'Finanzas' },
            { label: 'Office 365', sub: 'M365' },
            { label: 'Power BI', sub: 'Reportes' },
          ].map((app, i) => {
            const col = i % 3
            const row = Math.floor(i / 3)
            const x = 70 + col * 210
            const y = 348 + row * 52
            return (
              <g key={app.label}>
                <rect x={x} y={y} width="180" height="42" rx="4" fill="#F8F9FA" stroke="#70AD47" />
                <text x={x + 90} y={y + 18} textAnchor="middle" fontSize="10" fontWeight="600">
                  {app.label}
                </text>
                <text x={x + 90} y={y + 32} textAnchor="middle" fontSize="8" fill="#6B7280">
                  {app.sub}
                </text>
                <line
                  x1={x + 90}
                  y1={y}
                  x2={380}
                  y2={292}
                  stroke="#70AD47"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                  opacity={0.6}
                />
              </g>
            )
          })}
        </svg>

        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-[var(--navy)]">Principios de integración propuestos</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              <strong>Identidad:</strong> Active Directory como fuente; portales autentican vía LDAP/Entra
              (no usuarios locales en producción).
            </li>
            <li>
              <strong>ERP:</strong> SAP Business One en HANA (nube) expone datos solo por{' '}
              <strong>Service Layer</strong>; usuario de integración dedicado por ambiente.
            </li>
            <li>
              <strong>Hub RCJ:</strong> La capa NestJS/BFF concentra llamadas a SAP, valida tokens y
              estandariza errores — evita que cada portal hable directo con SAP.
            </li>
            <li>
              <strong>Datos locales:</strong> SQL Server / MongoDB para operación de portales; sincronización
              de maestros y transacciones financieras vía el hub hacia SAP.
            </li>
            <li>
              <strong>Sin AWS:</strong> archivos adjuntos y backups en infraestructura corporativa (file
              server, Azure Files o on-prem) alineada a políticas RCJ.
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
