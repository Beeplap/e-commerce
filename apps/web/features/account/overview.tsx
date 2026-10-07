"use client";
import Link from "next/link";
import { AccountFrame } from "./frame";
import { AccountStatus } from "./shared";

export function CustomerAccountOverview() {
  return (
    <AccountFrame
      title="My account"
      description="Your details, deliveries and purchases in one place."
    >
      {(user) => (
        <>
          <section className="sf-account-section">
            <h2>Account details</h2>
            <dl className="sf-account-details">
              <div>
                <dt>Name</dt>
                <dd>
                  {[user.first_name, user.last_name]
                    .filter(Boolean)
                    .join(" ") || "Not set"}
                </dd>
              </div>
              <div>
                <dt>Email address</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>Email verification</dt>
                <dd>
                  <AccountStatus
                    status={user.is_email_verified ? "verified" : "unverified"}
                  />
                </dd>
              </div>
            </dl>
            {!user.is_email_verified && (
              <p className="sf-account-help">
                Email verification requests are not available here yet.
              </p>
            )}
            <Link className="sf-account-link" href="/account/profile">
              Edit profile & security
            </Link>
          </section>
          <section
            className="sf-account-overview-links"
            aria-label="Account tasks"
          >
            <Link href="/account/orders">
              <span>Orders</span>
              <small>Order details, seller packages and tracking.</small>
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/account/addresses">
              <span>Address book</span>
              <small>Manage your saved delivery addresses.</small>
              <span aria-hidden="true">→</span>
            </Link>
          </section>
        </>
      )}
    </AccountFrame>
  );
}
