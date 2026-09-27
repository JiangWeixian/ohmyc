//! Local-week metrics for the native menu bar. Independent of webview lifetime.
#[cfg(target_os = "macos")]
pub mod macos;
use chrono::{DateTime, Datelike, TimeZone};
use ohmyc_core::timeline::TimelineSummary;

/// Current local calendar week: Monday inclusive to next Monday exclusive.
pub fn week_bounds<Tz: TimeZone>(now: DateTime<Tz>) -> Option<(i64, i64)> {
    let date = now.date_naive();
    let monday = date.checked_sub_days(chrono::Days::new(u64::from(date.weekday().num_days_from_monday())))?;
    let next_monday = monday.checked_add_days(chrono::Days::new(7))?;
    let tz = now.timezone();
    let first_in_day = |date: chrono::NaiveDate| {
        (0..24 * 60).find_map(|minute| {
            let time = date.and_hms_opt(minute / 60, minute % 60, 0)?;
            tz.from_local_datetime(&time).earliest()
        })
    };
    Some((
        first_in_day(monday)?.timestamp_millis(),
        first_in_day(next_monday)?.timestamp_millis(),
    ))
}

pub fn compact(value: i64) -> String {
    let mut value = value.max(0) as f64;
    let units = ["", "K", "M", "B", "T", "P", "E"];
    let mut unit = 0;
    while value >= 999.95 && unit < units.len() - 1 {
        value /= 1000.0;
        unit += 1;
    }
    if unit == 0 {
        return format!("{value:.0}");
    }
    let number = format!("{:.1}", (value * 10.0).round() / 10.0);
    format!("{}{}", number.trim_end_matches(".0"), units[unit])
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Display {
    pub tokens: String,
    pub sessions: String,
    pub description: String,
}

impl Display {
    pub fn new(date: &str, summary: Option<TimelineSummary>) -> Self {
        match summary {
            Some(total) => Self {
                tokens: compact(total.tokens),
                sessions: compact(total.sessions),
                description: format!(
                    "OhMyC — This week (Mon–Sun, local time; today {date}): {} tokens, {} sessions. Tokens include input and output, with cache counted once, within the selected statistics basis. Recorded data; refreshes every 30 seconds.",
                    total.tokens, total.sessions
                ),
            },
            None => Self {
                tokens: "—".into(),
                sessions: "—".into(),
                description: format!("OhMyC — This week (Mon–Sun; today {date}): activity unavailable. Open OhMyC to check the monitor connection."),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::FixedOffset;

    #[test]
    fn unavailable_is_distinct_from_a_valid_empty_day() {
        let absent = Display::new("2026-09-26", None);
        let empty = Display::new("2026-09-26", Some(TimelineSummary::default()));
        assert_eq!((absent.tokens.as_str(), absent.sessions.as_str()), ("—", "—"));
        assert_eq!((empty.tokens.as_str(), empty.sessions.as_str()), ("0", "0"));
        let total = Display::new(
            "2026-09-26",
            Some(TimelineSummary {
                tokens: 128400,
                sessions: 8,
            }),
        );
        assert!(total.description.contains("128400 tokens, 8 sessions"));
    }

    #[test]
    fn calendar_week_starts_monday_and_ends_next_monday() {
        let tz = FixedOffset::east_opt(8 * 3600).unwrap();
        let start = tz.with_ymd_and_hms(2026, 9, 28, 0, 0, 0).unwrap();
        let end = tz.with_ymd_and_hms(2026, 10, 5, 0, 0, 0).unwrap();
        for now in [
            start,
            tz.with_ymd_and_hms(2026, 10, 1, 12, 0, 0).unwrap(),
            tz.with_ymd_and_hms(2026, 10, 4, 23, 59, 59).unwrap(),
        ] {
            assert_eq!(
                week_bounds(now).unwrap(),
                (start.timestamp_millis(), end.timestamp_millis())
            );
        }
        assert_eq!(week_bounds(end).unwrap().0, end.timestamp_millis());
        assert!(Display::new("2026-10-01", None).description.contains("This week"));
    }

    #[test]
    fn calendar_week_handles_year_boundary_and_dst() {
        let tz = FixedOffset::east_opt(8 * 3600).unwrap();
        let now = tz.with_ymd_and_hms(2027, 1, 1, 12, 0, 0).unwrap();
        assert_eq!(
            week_bounds(now).unwrap().0,
            tz.with_ymd_and_hms(2026, 12, 28, 0, 0, 0).unwrap().timestamp_millis()
        );
        let tz = chrono_tz::America::New_York;
        for (month, day, hours) in [(3, 8, 167), (11, 1, 169)] {
            let now = tz.with_ymd_and_hms(2026, month, day, 12, 0, 0).unwrap();
            let (start, end) = week_bounds(now).unwrap();
            assert_eq!(end - start, hours * 3600 * 1000);
        }
    }

    #[test]
    fn compact_values_fit_the_fixed_columns_without_rounding_to_1000k() {
        for (value, expected) in [
            (0, "0"),
            (999, "999"),
            (1000, "1K"),
            (128_400, "128.4K"),
            (999_999, "1M"),
            (1_250_000, "1.3M"),
            (1_000_000_000, "1B"),
            (i64::MAX, "9.2E"),
        ] {
            assert_eq!(compact(value), expected, "{value}");
        }
    }
}
