# endlessh-notify

[![Latest Release](https://img.shields.io/github/v/release/foxxmd/endlessh-notify)](https://github.com/FoxxMD/endlessh-notify/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Pulls](https://img.shields.io/docker/pulls/foxxmd/endlessh-notify)](https://hub.docker.com/r/foxxmd/endlessh-notify)

Event notification for [endlessh](https://github.com/skeeto/endlessh) and [endlessh-go](https://github.com/shizunge/endlessh-go)

<img src="/assets/discord.jpg" width="476">

# What Does It Do?

endlessh-notify tails the logs from your endlessh instance and will send notifications using [Discord webhooks](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks), [ntfy](https://ntfy.sh/), and [gotify](https://gotify.net/) when any of these events occurs:

* New* IP tries to connect
* New* IP disconnect (coming soon)

*You can control how an IP is considered "new" based on when it was last seen.

# Prerequisites

* A running [endlessh](https://github.com/skeeto/endlessh) or [endlessh-go](https://github.com/shizunge/endlessh-go) instance **with file logging enabled.**
  * Access to log files
* A [Discord webhook](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks), running [ntfy](https://ntfy.sh/) instance, or running [gotify](https://gotify.net/) instance

# Quick Start

Assuming:

* Using docker
* Endlessh log files are located at `/home/user/endlessLogs` on your host system
* A discord webhook `https://discord.com/api/webhooks/MY_WEBHOOK`
* Notify if IP from event hasn't been seen before or was last seen more than 24 hours ago

```shell
docker run -d -e DISCORD_WEBHOOK="https://discord.com/api/webhooks/MY_WEBHOOK" -e DEBOUNCE_INTERVAL="1 day" -v /home/user/endlessLogs:/endlessh foxxmd/endlessh-notify
```

# Install

## Docker

* [Dockerhub](https://hub.docker.com/r/foxxmd/endlessh-notify) - `docker.io/foxxmd/endlessh-notify`
* [GHCR](https://github.com/foxxmd/endlessh-notify/pkgs/container/endlessh-notify) - `ghcr.io/foxxmd/endlessh-notify`

(Optionally) Set the [timezone](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) for the container using the environmental variable `TZ` ([docker](https://docs.docker.com/engine/reference/commandline/run/#env)) ([docker-compose](https://docs.docker.com/compose/compose-file/compose-file-v3/#environment))

#### Storage Mount

You **must** bind the directory on the host containing the endlessh log files to `/endless` in the container.

* [Using `-v` method for docker](https://docs.docker.com/storage/bind-mounts/#start-a-container-with-a-bind-mount): `-v /path/on/host/logs:/endlessh`
* [Using docker-compose](https://docs.docker.com/compose/compose-file/compose-file-v3/#short-syntax-3): `- /path/on/host/logs:/endlessh`

#### Config Mount

If you use a [Config file](#configuring-notifiers) you must bind the directory on the host containing the config file to `/config` in the container

* [Using `-v` method for docker](https://docs.docker.com/storage/bind-mounts/#start-a-container-with-a-bind-mount): `-v /path/on/host/config:/config`
* [Using docker-compose](https://docs.docker.com/compose/compose-file/compose-file-v3/#short-syntax-3): `- /path/on/host/config:/config`

#### Linux Host

If you are

* using [rootless containers with Podman](https://developers.redhat.com/blog/2020/09/25/rootless-containers-with-podman-the-basics#why_podman_)
* running docker on MacOS or Windows

this **DOES NOT** apply to you.

If you are running Docker on a **Linux Host** you must specify `user:group` permissions of the user who owns the **configuration directory** on the host to avoid [docker file permission problems.](https://ikriv.com/blog/?p=4698) These can be specified using the [environmental variables **PUID** and **PGID**.](https://docs.linuxserver.io/general/understanding-puid-and-pgid)

To get the UID and GID for the current user run these commands from a terminal:

* `id -u` -- prints UID
* `id -g` -- prints GID

### Full Example

Assuming

* Host UID is `99`
* Host GID is `1000`
* Config using ENV
* Discord with Mapquest
* Logs at `/home/myUser/endlessLogs`


```shell
docker run -d -e PUID=99 PGID=100 -e DISCORD_WEBHOOK="https://discord.com/api/webhooks/MY_WEBHOOK" -e MAPQUEST_KEY="V3CPFmir2JEnj" -v /home/myUser/endlessLogs:/endlessh foxxmd/endlessh-notify
```

* Using config-file instead of ENVs

```shell
docker run -d -e PUID=99 PGID=100 -v /home/myUser/endlessh-notify-config:/config  -v /home/myUser/endlessLogs:/endlessh foxxmd/endlessh-notify
```

## Local (Node)

```shell
clone https://github.com/FoxxMD/endlessh-notify.git .
cd endlessh-notify
npm install
npm run start
```

Local install may also use ENVs instead of config files. Directory locations are controlled with ENVs:

* `CONFIG_DIR` => Default `./config` => Directory location of endlessh-notify config
* `ENDLESS_DIR` => Default `./endlessData` => Directory location of endlessh logs

# Configuring Endlessh

endlessh-notify parses events using log files generated by endlessh. **You must enable file logging on your instance for endlessh-notify to work.**

### [endlessh](https://github.com/skeeto/endlessh)

* If using [Linuxserver.io](https://docs.linuxserver.io/images/docker-endlessh/#application-setup) version add ENV `LOGFILE=true` to your run command
* Using endlessh directly -- add `-s` to command output and setup a [config file](https://github.com/skeeto/endlessh#sample-configuration-file) with `LogLevel 1`

### [endlessh-go](https://github.com/shizunge/endlessh-go)

Add these arguments to your run command (make sure `log_dir` is a viable directory):

```
-alsologtostderr -v=1 -log_dir=/config
```

# Configuring Notifiers

endlessh-notify can have one or many **Notifiers.** Each Notifier has its own defined behavior on how to handle events parsed from endlessh.

Notifiers can be configured with

* **environmental variables** outlined in the sections below
* using a **config file**, see [`config.yaml`](/config/config.yaml.example) for a kitchensink example

Common behavior that can be defined for all notifiers:

#### Debounce Interval

This duration determines how "old" a previously seen IP must be before it is considered "new". If an IP has not been seen before it is always new. The default is `1 hour`.

The syntax for a duration is `[Value] [Unit]` where unit is any [available unit from Dayjs](https://day.js.org/docs/en/durations/creating#list-of-all-available-units), examples:

* `18 minutes`
* `1 hour`
* `4 days`

Debounce can be configured:

* For all notifiers using ENV => Set with `DEBOUNCE_INTERVAL` env IE `DEBOUNCE_INTERVAL="6 hours"`
* Per notifier using a config file => sSee [`config.yaml` example](/config/config.yaml.example)

## Specific Notifiers

### Discord

Create a [webhook](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks) for a Discord server you have proper permissions for.

Optionally, get a [Mapquest Key](https://developer.mapquest.com/documentation/) for endless-notify to generate map images of approximate IP locations in the Discord message.


|        Name         | Required | Default |                Description                |
|---------------------|----------|---------|-------------------------------------------|
| `DISCORD_WEBHOOK`   | **Yes**  |         |                                           |
| `MAPQUEST_KEY`      | No       |         | Used to generate map image of IP location |
| `DEBOUNCE_INTERVAL` | No       | 1 hour  |                                           |


Or see [`config.yaml` example](/config/config.yaml.example)

### Ntfy

|        Name         | Required | Default | Description |
|---------------------|----------|---------|-------------|
| `NTFY_URL`          | **Yes**  |         |             |
| `NTFY_TOPIC`        | **Yes**  |         |             |
| `NTFY_USER`         | No       |         |             |
| `NTFY_PASS`         | No       |         |             |
| `DEBOUNCE_INTERVAL` | No       | 1 hour  |             |

Or see [`config.yaml` example](/config/config.yaml.example)

### Gotify

|        Name         | Required | Default | Description |
|---------------------|----------|---------|-------------|
| `GOTIFY_URL`        | **Yes**  |         |             |
| `GOTIFY_TOKEN`      | **Yes**  |         |             |
| `DEBOUNCE_INTERVAL` | No       | 1 hour  |             |

Or see [`config.yaml` example](/config/config.yaml.example)
