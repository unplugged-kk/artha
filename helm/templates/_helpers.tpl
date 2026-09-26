{{/*
Expand the name of the chart.
*/}}
{{- define "artha.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "artha.fullname" -}}
{{- default .Release.Name .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Chart label values.
*/}}
{{- define "artha.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Resolve the application hostname.
Defaults to artha.<global.domain>
*/}}
{{- define "artha.hostname" -}}
{{- if .Values.global.hostname }}
{{- .Values.global.hostname }}
{{- else }}
{{- printf "artha.%s" .Values.global.domain }}
{{- end }}
{{- end }}

{{/*
Resolve the public app URL.
Defaults to https://<hostname>
*/}}
{{- define "artha.publicAppUrl" -}}
{{- printf "https://%s" (include "artha.hostname" .) }}
{{- end }}

{{/*
Resolve the OIDC issuer URL.
Defaults to https://auth.<global.domain>
*/}}
{{- define "artha.oidcIssuerUrl" -}}
{{- if .Values.backend.oidc.OIDC_ISSUER_URL }}
{{- .Values.backend.oidc.OIDC_ISSUER_URL }}
{{- else }}
{{- printf "https://auth.%s" .Values.global.domain }}
{{- end }}
{{- end }}

{{/*
Resolve the OIDC callback URL.
Defaults to https://<hostname>/api/v1/auth/oidc/callback
*/}}
{{- define "artha.oidcCallbackUrl" -}}
{{- if .Values.backend.oidc.OIDC_CALLBACK_URL }}
{{- .Values.backend.oidc.OIDC_CALLBACK_URL }}
{{- else }}
{{- printf "https://%s/api/v1/auth/oidc/callback" (include "artha.hostname" .) }}
{{- end }}
{{- end }}

{{/*
Resolve the internal API URL for the frontend.
Defaults to http://artha-backend-service:<backend.service.port>
*/}}
{{- define "artha.internalApiUrl" -}}
{{- if .Values.frontend.app.INTERNAL_API_URL }}
{{- .Values.frontend.app.INTERNAL_API_URL }}
{{- else }}
{{- printf "http://artha-backend-service:%v" (.Values.backend.service.port | int) }}
{{- end }}
{{- end }}

{{/*
Common labels for backend resources.
*/}}
{{- define "artha.backend.labels" -}}
app: artha-backend
app.kubernetes.io/name: artha-backend
app.kubernetes.io/version: {{ .Values.backend.image.tag | quote }}
app.kubernetes.io/component: backend
app.kubernetes.io/part-of: artha
helm.sh/chart: {{ include "artha.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels for backend.
*/}}
{{- define "artha.backend.selectorLabels" -}}
app: artha-backend
{{- end }}

{{/*
Common labels for frontend resources.
*/}}
{{- define "artha.frontend.labels" -}}
app: artha-frontend
app.kubernetes.io/name: artha-frontend
app.kubernetes.io/version: {{ .Values.frontend.image.tag | quote }}
app.kubernetes.io/component: frontend
app.kubernetes.io/part-of: artha
helm.sh/chart: {{ include "artha.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels for frontend.
*/}}
{{- define "artha.frontend.selectorLabels" -}}
app: artha-frontend
{{- end }}

{{/*
The configured attachment storage provider, read out of backend.extraEnv so
NOTES.txt can warn when "local" has no volume behind it. Defaults to "database",
matching the backend's own default.
*/}}
{{- define "artha.attachmentProvider" -}}
{{- $provider := "database" -}}
{{- range .Values.backend.extraEnv -}}
{{- if eq .name "ATTACHMENT_STORAGE_PROVIDER" -}}
{{- $provider = .value | default "database" -}}
{{- end -}}
{{- end -}}
{{- $provider | lower -}}
{{- end -}}
