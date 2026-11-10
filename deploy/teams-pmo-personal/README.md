# Empaque Teams — PMO Personal

1. Sustituye `YOUR_BOT_APP_ID` en `manifest.json` por el Application ID del bot en Azure (mismo valor que `PMO_BOT_APP_ID`).
2. Agrega `color.png` (192×192) y `outline.png` (32×32, blanco transparente).
3. Zip en la raíz (sin subcarpeta):

```powershell
Compress-Archive -Path manifest.json,color.png,outline.png -DestinationPath PMO-Personal.zip -Force
```

4. Sube el ZIP en Teams (Apps → Upload a custom app).
