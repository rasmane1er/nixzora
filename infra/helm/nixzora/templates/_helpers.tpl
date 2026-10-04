{{/* Resource names: "<release>-<component>", e.g. "nixzora-api". */}}
{{- define "nixzora.name" -}}
{{- printf "%s-%s" .root.Release.Name .component | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "nixzora.labels" -}}
app.kubernetes.io/name: {{ .root.Chart.Name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
app.kubernetes.io/version: {{ .root.Values.image.tag | quote }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .root.Chart.Name .root.Chart.Version }}
{{- end -}}

{{- define "nixzora.selectorLabels" -}}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/* "<registry>/nixzora/<repository>:<tag>" */}}
{{- define "nixzora.image" -}}
{{- printf "%s/nixzora/%s:%s" .root.Values.image.registry .repository .root.Values.image.tag -}}
{{- end -}}

{{/* In-cluster URL of a workload: http://<release>-<component>:<port> */}}
{{- define "nixzora.url" -}}
{{- $svc := index .root.Values.services .component -}}
{{- printf "http://%s-%s:%v" .root.Release.Name .component $svc.port -}}
{{- end -}}

{{/* Environment shared by the API image's processes, derived from the values. */}}
{{- define "nixzora.apiEnv" -}}
{{- $v := .Values -}}
{{- $env := dict
  "API_PUBLIC_URL" (printf "https://%s" $v.hosts.api)
  "WEB_APP_URL" (printf "https://%s" $v.hosts.storefront)
  "CORS_ORIGINS" (printf "https://%s,https://%s" $v.hosts.storefront $v.hosts.admin)
  "APP_VERSION" (toString $v.image.tag)
  "DATABASE_HOST" $v.aws.databaseHost
  "DATABASE_REPLICA_HOST" ($v.aws.replicaHost | default "")
  "DATABASE_PORT" "5432"
  "DATABASE_NAME" $v.aws.databaseName
  "DATABASE_USER" $v.aws.databaseUser
  "REDIS_HOST" $v.aws.redisHost
  "S3_BUCKET" $v.aws.mediaBucket
  "S3_REGION" $v.aws.region
  "SES_REGION" $v.aws.region
  "ASSETS_BASE_URL" (printf "https://%s" $v.aws.mediaHost)
  "MAIL_FROM" $v.aws.mailFrom
-}}
{{- if $v.services.search.enabled }}{{ $_ := set $env "SEARCH_SERVICE_URL" (include "nixzora.url" (dict "root" . "component" "search")) }}{{ end -}}
{{- if $v.services.ai.enabled }}{{ $_ := set $env "AI_SERVICE_URL" (include "nixzora.url" (dict "root" . "component" "ai")) }}{{ end -}}
{{- if $v.services.worker.enabled }}{{ $_ := set $env "BACKGROUND_JOBS" "false" }}{{ end -}}
{{- range $key, $value := $v.apiEnv }}{{ $_ := set $env $key (toString $value) }}{{ end -}}
{{- range $key := keys $env | sortAlpha }}
{{- $value := index $env $key }}
{{- if $value }}
{{ $key }}: {{ $value | quote }}
{{- end }}
{{- end }}
{{- end -}}
