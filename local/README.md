Anything in this directory stays on the machine it was written on.

It exists for working notes that must not reach a repository — IMEIs, SIM
numbers, credentials. The tag protocol authenticates by IMEI alone and the
gateway listens on a public address, so a published IMEI is a list entry
somebody can inject fabricated positions against. That is why the application
masks them to four digits everywhere they appear on screen.

The whole directory is gitignored except this file.
