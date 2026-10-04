// A minimal offline stand-in for "helm template", for environments without Helm: Go's
// text/template plus the Helm/Sprig functions this chart uses. Values come in as JSON.
//
//	go run . -chart ../../nixzora -values values.json -release nixzora -namespace nixzora
//
// CI uses the real Helm (helm lint, helm template, kubeconform); this only lets the chart be
// checked where Helm cannot be installed.
package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"text/template"
)

func main() {
	chartDir := flag.String("chart", "", "chart directory")
	valuesFile := flag.String("values", "", "merged values as JSON")
	release := flag.String("release", "nixzora", "release name")
	namespace := flag.String("namespace", "default", "namespace")
	flag.Parse()

	var values map[string]any
	raw, err := os.ReadFile(*valuesFile)
	check(err)
	check(json.Unmarshal(raw, &values))

	chart := map[string]any{"Name": "nixzora", "Version": "0.1.0"}
	data := map[string]any{
		"Values":  values,
		"Release": map[string]any{"Name": *release, "Namespace": *namespace, "Service": "Helm"},
		"Chart":   chart,
	}

	root := template.New("chart").Option("missingkey=zero")
	funcs := template.FuncMap{
		"include": func(name string, data any) (string, error) {
			var buf bytes.Buffer
			err := root.ExecuteTemplate(&buf, name, data)
			return buf.String(), err
		},
		"toYaml":  func(v any) string { return strings.TrimSuffix(toYaml(v, 0), "\n") },
		"nindent": func(n int, s string) string { return "\n" + indent(n, s) },
		"indent":  indent,
		"quote":   func(v any) string { return strconv.Quote(toString(v)) },
		"default": func(d, v any) any {
			if empty(v) {
				return d
			}
			return v
		},
		"trunc": func(n int, s string) string {
			if len(s) > n {
				return s[:n]
			}
			return s
		},
		"trimSuffix": func(suffix, s string) string { return strings.TrimSuffix(s, suffix) },
		"dict": func(kv ...any) map[string]any {
			m := map[string]any{}
			for i := 0; i+1 < len(kv); i += 2 {
				m[kv[i].(string)] = kv[i+1]
			}
			return m
		},
		"list":   func(v ...any) []any { return v },
		"append": func(l []any, v any) []any { return append(append([]any{}, l...), v) },
		"set":    func(m map[string]any, k string, v any) map[string]any { m[k] = v; return m },
		"keys": func(m map[string]any) []string {
			out := []string{}
			for k := range m {
				out = append(out, k)
			}
			return out
		},
		"sortAlpha": func(l []string) []string { sort.Strings(l); return l },
		"toString":  toString,
		"int":       func(v any) int { f, _ := strconv.ParseFloat(toString(v), 64); return int(f) },
		"sha256sum": func(s string) string { h := sha256.Sum256([]byte(s)); return hex.EncodeToString(h[:]) },
	}
	root.Funcs(funcs)

	files, err := filepath.Glob(filepath.Join(*chartDir, "templates", "*"))
	check(err)
	sort.Strings(files)
	var manifests []string
	for _, file := range files {
		text, err := os.ReadFile(file)
		check(err)
		_, err = root.New(filepath.Base(file)).Parse(string(text))
		check(err)
		if strings.HasSuffix(file, ".yaml") {
			manifests = append(manifests, filepath.Base(file))
		}
	}
	for _, name := range manifests {
		var buf bytes.Buffer
		if err := root.ExecuteTemplate(&buf, name, data); err != nil {
			fmt.Fprintf(os.Stderr, "%s: %v\n", name, err)
			os.Exit(1)
		}
		fmt.Printf("---\n# Source: nixzora/templates/%s\n%s\n", name, buf.String())
	}
}

func check(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func indent(n int, s string) string {
	pad := strings.Repeat(" ", n)
	return pad + strings.ReplaceAll(s, "\n", "\n"+pad)
}

func empty(v any) bool {
	switch x := v.(type) {
	case nil:
		return true
	case string:
		return x == ""
	case bool:
		return !x
	case float64:
		return x == 0
	case int:
		return x == 0
	case []any:
		return len(x) == 0
	case map[string]any:
		return len(x) == 0
	}
	return false
}

func toString(v any) string {
	switch x := v.(type) {
	case nil:
		return ""
	case string:
		return x
	case float64:
		return strconv.FormatFloat(x, 'f', -1, 64)
	}
	return fmt.Sprint(v)
}

// YAML for the shapes JSON values take: maps (sorted keys), lists and scalars.
func toYaml(v any, depth int) string {
	pad := strings.Repeat("  ", depth)
	switch x := v.(type) {
	case map[string]any:
		if len(x) == 0 {
			return "{}\n"
		}
		keys := make([]string, 0, len(x))
		for k := range x {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		var b strings.Builder
		for _, k := range keys {
			child := x[k]
			switch c := child.(type) {
			case map[string]any:
				if len(c) == 0 {
					fmt.Fprintf(&b, "%s%s: {}\n", pad, k)
				} else {
					fmt.Fprintf(&b, "%s%s:\n%s", pad, k, toYaml(c, depth+1))
				}
			case []any:
				if len(c) == 0 {
					fmt.Fprintf(&b, "%s%s: []\n", pad, k)
				} else {
					fmt.Fprintf(&b, "%s%s:\n%s", pad, k, toYaml(c, depth))
				}
			default:
				fmt.Fprintf(&b, "%s%s: %s\n", pad, k, scalar(c))
			}
		}
		return b.String()
	case []any:
		var b strings.Builder
		for _, item := range x {
			switch c := item.(type) {
			case map[string]any, []any:
				inner := toYaml(c, depth+1)
				fmt.Fprintf(&b, "%s- %s", pad, strings.TrimPrefix(inner, pad+"  "))
			default:
				fmt.Fprintf(&b, "%s- %s\n", pad, scalar(c))
			}
		}
		return b.String()
	}
	return scalar(v) + "\n"
}

func scalar(v any) string {
	switch x := v.(type) {
	case string:
		return strconv.Quote(x)
	case nil:
		return "null"
	}
	return toString(v)
}
