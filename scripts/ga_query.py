#!/usr/bin/env python3
"""Query Google Analytics 4 data for ChipNotes."""

import json
import os
import sys
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange, Dimension, Metric, RunReportRequest, OrderBy
)
from google_auth_oauthlib.flow import InstalledAppFlow

PROPERTY_ID = "520100308"
SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"]
CLIENT_SECRET = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "client_secret_861992681978-c688jmccitae3knp6kqcjf4h1gqkoouo.apps.googleusercontent.com.json"
)
TOKEN_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ga_token.json")


def get_credentials():
    """Get or refresh OAuth credentials."""
    from google.oauth2.credentials import Credentials

    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
        if creds.valid:
            return creds
        if creds.expired and creds.refresh_token:
            from google.auth.transport.requests import Request
            creds.refresh(Request())
            with open(TOKEN_FILE, "w") as f:
                f.write(creds.to_json())
            return creds

    flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET, SCOPES)
    creds = flow.run_local_server(port=0)
    with open(TOKEN_FILE, "w") as f:
        f.write(creds.to_json())
    return creds


def make_client():
    creds = get_credentials()
    return BetaAnalyticsDataClient(credentials=creds)


def run_report(client, dimensions, metrics, date_range="90daysAgo",
               dim_filter=None, order_by=None, limit=50):
    """Run a GA4 report and return rows."""
    request = RunReportRequest(
        property=f"properties/{PROPERTY_ID}",
        dimensions=[Dimension(name=d) for d in dimensions],
        metrics=[Metric(name=m) for m in metrics],
        date_ranges=[DateRange(start_date=date_range, end_date="today")],
        limit=limit,
    )
    if dim_filter:
        request.dimension_filter = dim_filter
    if order_by:
        request.order_bys = order_by

    response = client.run_report(request)
    return response


def print_report(response, title=""):
    """Pretty-print a GA4 report response."""
    if title:
        print(f"\n{'='*60}")
        print(f"  {title}")
        print(f"{'='*60}")

    if not response.rows:
        print("  (no data)")
        return

    # Header
    headers = [h.name for h in response.dimension_headers] + [h.name for h in response.metric_headers]
    widths = [max(len(h), 12) for h in headers]

    # Calculate widths from data
    for row in response.rows:
        vals = [d.value for d in row.dimension_values] + [m.value for m in row.metric_values]
        for i, v in enumerate(vals):
            widths[i] = max(widths[i], len(str(v)))

    fmt = "  ".join(f"{{:<{w}}}" for w in widths)
    print()
    print(fmt.format(*headers))
    print(fmt.format(*["-" * w for w in widths]))
    for row in response.rows:
        vals = [d.value for d in row.dimension_values] + [m.value for m in row.metric_values]
        print(fmt.format(*vals))
    print()


def overview(client):
    """High-level traffic overview."""
    r = run_report(client,
        dimensions=["date"],
        metrics=["activeUsers", "sessions", "screenPageViews"],
        date_range="30daysAgo",
        order_by=[OrderBy(dimension=OrderBy.DimensionOrderBy(dimension_name="date"))],
        limit=31)
    print_report(r, "Daily Traffic (Last 30 Days)")

    r = run_report(client,
        dimensions=[],
        metrics=["activeUsers", "sessions", "screenPageViews", "averageSessionDuration"],
        date_range="30daysAgo")
    print_report(r, "30-Day Summary")


def events(client):
    """Event breakdown."""
    r = run_report(client,
        dimensions=["eventName"],
        metrics=["eventCount", "totalUsers"],
        date_range="90daysAgo",
        order_by=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="eventCount"), desc=True)],
        limit=30)
    print_report(r, "All Events (Last 90 Days)")


def pack_popularity(client):
    """Which packs are being selected. Requires custom dimensions registered in GA4."""
    from google.analytics.data_v1beta.types import FilterExpression, Filter
    # Try customEvent: first (requires GA4 custom dimension registration)
    # Fall back to just showing event counts if not registered
    try:
        r = run_report(client,
            dimensions=["customEvent:pack_name"],
            metrics=["eventCount"],
            date_range="90daysAgo",
            dim_filter=FilterExpression(
                filter=Filter(
                    field_name="eventName",
                    string_filter=Filter.StringFilter(value="pack_select")
                )
            ),
            order_by=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="eventCount"), desc=True)],
            limit=30)
        print_report(r, "Pack Popularity (Last 90 Days)")
    except Exception:
        print("\n" + "="*60)
        print("  Pack Popularity - Custom Dimensions Not Registered")
        print("="*60)
        print()
        print("  To see pack-level breakdowns, register custom dimensions in GA4:")
        print("  Admin > Custom definitions > Create custom dimension")
        print("  - Dimension name: pack_name, Scope: Event, Event parameter: pack_name")
        print("  - Dimension name: pack_id, Scope: Event, Event parameter: pack_id")
        print("  - Dimension name: level_id, Scope: Event, Event parameter: level_id")
        print("  - Dimension name: level_title, Scope: Event, Event parameter: level_title")
        print("  - Dimension name: enabled, Scope: Event, Event parameter: enabled")
        print("  - Dimension name: species_count, Scope: Event, Event parameter: species_count")
        print()
        print("  Data will be available ~24h after registration (not retroactive).")
        print()


def round_stats(client):
    """Round completion stats. Requires custom dimensions registered in GA4."""
    from google.analytics.data_v1beta.types import FilterExpression, Filter
    try:
        r = run_report(client,
            dimensions=["customEvent:pack_id"],
            metrics=["eventCount"],
            date_range="90daysAgo",
            dim_filter=FilterExpression(
                filter=Filter(
                    field_name="eventName",
                    string_filter=Filter.StringFilter(value="round_complete")
                )
            ),
            order_by=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="eventCount"), desc=True)],
            limit=30)
        print_report(r, "Rounds Completed by Pack (Last 90 Days)")
    except Exception:
        print("\n  (Rounds by pack requires custom dimensions - see 'packs' report for setup instructions)")


def devices(client):
    """Device and platform breakdown."""
    r = run_report(client,
        dimensions=["deviceCategory"],
        metrics=["activeUsers", "sessions"],
        date_range="30daysAgo",
        order_by=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="activeUsers"), desc=True)])
    print_report(r, "Devices (Last 30 Days)")

    r = run_report(client,
        dimensions=["operatingSystem"],
        metrics=["activeUsers"],
        date_range="30daysAgo",
        order_by=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="activeUsers"), desc=True)],
        limit=10)
    print_report(r, "Operating Systems (Last 30 Days)")


def geo(client):
    """Geographic breakdown."""
    r = run_report(client,
        dimensions=["country"],
        metrics=["activeUsers", "sessions"],
        date_range="30daysAgo",
        order_by=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="activeUsers"), desc=True)],
        limit=15)
    print_report(r, "Countries (Last 30 Days)")

    r = run_report(client,
        dimensions=["region"],
        metrics=["activeUsers"],
        date_range="30daysAgo",
        order_by=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="activeUsers"), desc=True)],
        limit=15)
    print_report(r, "Regions (Last 30 Days)")


def traffic_sources(client):
    """Where users come from."""
    r = run_report(client,
        dimensions=["sessionSource", "sessionMedium"],
        metrics=["activeUsers", "sessions"],
        date_range="30daysAgo",
        order_by=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
        limit=15)
    print_report(r, "Traffic Sources (Last 30 Days)")


def retention(client):
    """New vs returning users."""
    r = run_report(client,
        dimensions=["newVsReturning"],
        metrics=["activeUsers", "sessions"],
        date_range="30daysAgo")
    print_report(r, "New vs Returning Users (Last 30 Days)")


REPORTS = {
    "overview": ("Traffic overview", overview),
    "events": ("All events breakdown", events),
    "packs": ("Pack popularity", pack_popularity),
    "rounds": ("Round completion stats", round_stats),
    "devices": ("Device breakdown", devices),
    "geo": ("Geographic breakdown", geo),
    "sources": ("Traffic sources", traffic_sources),
    "retention": ("New vs returning users", retention),
    "all": ("Run all reports", None),
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in REPORTS:
        print("Usage: python3 scripts/ga_query.py <report>")
        print("\nAvailable reports:")
        for key, (desc, _) in REPORTS.items():
            print(f"  {key:12s} - {desc}")
        sys.exit(1)

    client = make_client()
    report = sys.argv[1]

    if report == "all":
        for key, (_, fn) in REPORTS.items():
            if fn:
                fn(client)
    else:
        REPORTS[report][1](client)


if __name__ == "__main__":
    main()
